"use client";

import {
  useAccount,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  useChainId,
  useWriteContract,
} from "wagmi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address, EIP1193Provider } from "viem";
import { getConnectorClient } from "@wagmi/core";
import { readContract } from "@wagmi/core";
import { wagmiConfig } from "@/lib/wagmi-config";
import {
  CORESID_CONTRACT_ADDRESS,
  CORESID_ABI,
  CORESID_CHAIN_ID,
  shortenAddress,
} from "@/lib/coresid";
import { BasedOneArt } from "@/components/basedone-art";

type AppStep = "connect" | "role" | "core" | "seed";

type CoreState = {
  seedCount: number;
  pendingCount: number;
  tokenId: number | null;
};

function errMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred.";
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.match(/User rejected/i)) return "Transaction was rejected in your wallet.";
    const revert = msg.match(/reverted with custom error '([^']+)'/);
    if (revert) return revert[1].replace(/([a-z])([A-Z])/g, "$1 $2");
    return msg.slice(0, 200);
  }
  return "An unexpected error occurred.";
}

function TouchSwipe({
  onSwipeLeft,
  onSwipeRight,
  children,
}: {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: React.ReactNode;
}) {
  const touchStart = useRef<number | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0]!.clientX;
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStart.current === null) return;
      const dx = e.changedTouches[0]!.clientX - touchStart.current;
      if (Math.abs(dx) > 50) {
        if (dx < 0) onSwipeLeft();
        else onSwipeRight();
      }
      touchStart.current = null;
    },
    [onSwipeLeft, onSwipeRight],
  );
  return <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>{children}</div>;
}

// --------------------------------------------------------------------------

export function CoresIDApp() {
  const { address, isConnected } = useAccount();
  const chainIdConnected = useChainId();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const connectors = useConnectors();
  const { writeContractAsync } = useWriteContract();

  // ---- state ----
  const [step, setStep] = useState<AppStep>("connect");
  const [role, setRole] = useState<"core" | "seed">("core");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);

  // Core state
  const [coreState, setCoreState] = useState<CoreState>({
    seedCount: 0,
    pendingCount: 0,
    tokenId: null,
  });
  const [nominateInputs, setNominateInputs] = useState<string[]>([""]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Seed state
  const [seedCoreAddress, setSeedCoreAddress] = useState("");

  // ---- connectors ----
  const baseConnector = useMemo(
    () =>
      connectors.find((c) => c.id === "baseAccount") ??
      connectors.find((c) => c.name.toLowerCase().includes("base")),
    [connectors],
  );

  const injectedConnector = useMemo(
    () =>
      connectors.find((c) => c.id === "injected") ??
      connectors.find((c) => c.type === "injected"),
    [connectors],
  );

  // ---- chain helpers ----
  const ensureChain = useCallback(async () => {
    if (chainIdConnected !== CORESID_CHAIN_ID) {
      await switchChainAsync({ chainId: CORESID_CHAIN_ID });
    }
  }, [chainIdConnected, switchChainAsync]);

  // ---- login ----
  async function handleLogin() {
    setIsSigningIn(true);
    setErrorMsg(null);
    setStatus("Opening Base App...");
    try {
      if (!baseConnector) throw new Error("No Base connector found.");
      await connectAsync({ connector: baseConnector });
      const client = await getConnectorClient(wagmiConfig, {
        connector: baseConnector,
      });
      setProvider(client as unknown as EIP1193Provider);
      await ensureChain();
      setStatus("Connected with Base.");
      setStep("role");
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Connection failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleInjectedLogin() {
    setIsSigningIn(true);
    setErrorMsg(null);
    setStatus("Opening browser wallet...");
    try {
      if (!injectedConnector) throw new Error("No injected wallet detected.");
      await connectAsync({ connector: injectedConnector });
      const client = await getConnectorClient(wagmiConfig, {
        connector: injectedConnector,
      });
      setProvider(client as unknown as EIP1193Provider);
      await ensureChain();
      setStatus("Connected with browser wallet.");
      setStep("role");
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Wallet connection failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSwitch() {
    try {
      await switchChainAsync({ chainId: CORESID_CHAIN_ID });
    } catch (error) {
      setErrorMsg(errMessage(error));
    }
  }

  function handleDisconnect() {
    disconnect();
    setStep("connect");
    setCoreState({ seedCount: 0, pendingCount: 0, tokenId: null });
    setNominateInputs([""]);
    setSeedCoreAddress("");
    setErrorMsg(null);
  }

  // ---- read core state from chain ----
  useEffect(() => {
    if (!address || step !== "core") return;

    const fetchCoreState = async () => {
      try {
        const coreAddr = address as Address;

        const seedCount = (await readContract(wagmiConfig, {
          address: CORESID_CONTRACT_ADDRESS,
          abi: CORESID_ABI,
          functionName: "seedCount",
          args: [coreAddr],
        })) as bigint;

        const pendingCount = (await readContract(wagmiConfig, {
          address: CORESID_CONTRACT_ADDRESS,
          abi: CORESID_ABI,
          functionName: "pendingCount",
          args: [coreAddr],
        })) as bigint;

        const coreTokenId = (await readContract(wagmiConfig, {
          address: CORESID_CONTRACT_ADDRESS,
          abi: CORESID_ABI,
          functionName: "coreTokenId",
          args: [coreAddr],
        })) as bigint;

        setCoreState({
          seedCount: Number(seedCount),
          pendingCount: Number(pendingCount),
          tokenId: Number(coreTokenId),
        });
      } catch {
        // contract not yet interacted with — fine
      }
    };

    fetchCoreState();
  }, [address, step, refreshKey]);

  // ---- nominate ----
  async function handleNominate() {
    setErrorMsg(null);
    setIsWorking(true);
    setStatus("Nominating seeds...");
    try {
      await ensureChain();
      const validAddresses = nominateInputs
        .map((a) => a.trim())
        .filter((a) => a.length === 42 && a.startsWith("0x")) as [Address, ...Address[]];

      if (validAddresses.length === 0) {
        throw new Error("Enter at least one valid address.");
      }

      const free = 5 - (coreState.seedCount + coreState.pendingCount);
      if (validAddresses.length > free) {
        throw new Error(`You only have ${free} slot(s) free. Remove some addresses.`);
      }

      await writeContractAsync({
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "nominate",
        args: [validAddresses],
      });

      setStatus("Nominated successfully!");
      setNominateInputs([""]);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Nomination failed.");
    } finally {
      setIsWorking(false);
    }
  }

  // ---- cancel nomination ----
  async function handleCancelNomination(seed: Address) {
    setErrorMsg(null);
    setIsWorking(true);
    setStatus("Cancelling nomination...");
    try {
      await ensureChain();
      await writeContractAsync({
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "cancelNomination",
        args: [seed],
      });
      setStatus("Nomination cancelled.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Cancel failed.");
    } finally {
      setIsWorking(false);
    }
  }

  // ---- mint as seed ----
  async function handleMint() {
    setErrorMsg(null);
    setIsWorking(true);
    setStatus("Minting...");
    try {
      await ensureChain();
      const coreAddr = seedCoreAddress.trim() as Address;
      if (!coreAddr || coreAddr.length !== 42) {
        throw new Error("Enter a valid core address.");
      }
      await writeContractAsync({
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "mint",
        args: [coreAddr],
      });
      setStatus("Minted! NFT leveled up on the core.");
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Mint failed.");
    } finally {
      setIsWorking(false);
    }
  }

  // ---- check nomination (seed view) ----
  async function handleCheckNomination() {
    setErrorMsg(null);
    setStatus("Checking...");
    setIsWorking(true);
    try {
      const coreAddr = seedCoreAddress.trim() as Address;
      if (!coreAddr || coreAddr.length !== 42) {
        throw new Error("Enter a valid core address.");
      }

      const nominated = (await readContract(wagmiConfig, {
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "isNominated",
        args: [coreAddr, address as Address],
      })) as boolean;

      const linked = (await readContract(wagmiConfig, {
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "coreOfSeed",
        args: [address as Address],
      })) as Address;

      const nullAddr = "0x0000000000000000000000000000000000000000";

      if (nominated) {
        if (linked === nullAddr) {
          setStatus("You are nominated by this core! Click 'Mint & Accept'.");
        } else {
          setStatus("You are already linked to this core.");
        }
      } else {
        if (linked !== nullAddr) {
          setStatus(`You are already linked to core ${shortenAddress(linked)}.`);
        } else {
          setStatus("You are not nominated by this core.");
        }
      }
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Check failed.");
    } finally {
      setIsWorking(false);
    }
  }

  // ---- input helpers ----
  function addInputField() {
    if (nominateInputs.length < 5) {
      setNominateInputs([...nominateInputs, ""]);
    }
  }

  function updateInput(index: number, value: string) {
    const next = [...nominateInputs];
    next[index] = value;
    setNominateInputs(next);
  }

  function removeInput(index: number) {
    if (nominateInputs.length > 1) {
      setNominateInputs(nominateInputs.filter((_, i) => i !== index));
    }
  }

  // ---- render ----
  const slotsFree = 5 - (coreState.seedCount + coreState.pendingCount);
  const isOnWrongChain = chainIdConnected !== CORESID_CHAIN_ID;

  if (step === "connect") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 py-6">
        <div className="flex w-full max-w-sm flex-col items-center">
          <div className="mb-6 w-48">
            <BasedOneArt />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
            CoresID
          </h1>
          <p className="mb-8 mt-2 text-center text-sm leading-relaxed text-[var(--muted)]">
            Link your EOAs to your Core wallet with a leveling soulbound NFT.
          </p>

          {!isConnected ? (
            <div className="flex w-full flex-col gap-3">
              <button
                type="button"
                onClick={handleLogin}
                disabled={isSigningIn}
                className="h-14 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSigningIn ? "Connecting..." : "Sign in with Base"}
              </button>
              <button
                type="button"
                onClick={handleInjectedLogin}
                disabled={isSigningIn || !injectedConnector}
                className="h-12 w-full rounded-[1.1rem] border border-[var(--line)] bg-white px-4 text-sm font-semibold tracking-[0.02em] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {injectedConnector
                  ? "Connect browser wallet (Rabby / MetaMask)"
                  : "No browser wallet detected"}
              </button>
            </div>
          ) : isOnWrongChain ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-[var(--muted)]">Wrong network</p>
              <button
                type="button"
                onClick={handleSwitch}
                className="h-12 rounded-[1.1rem] bg-[var(--foreground)] px-6 text-sm font-semibold text-white"
              >
                Switch to Base Sepolia
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStep("role")}
              className="h-14 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-4 text-sm font-semibold text-white"
            >
              Continue
            </button>
          )}

          {errorMsg && <p className="mt-4 text-center text-xs text-red-500">{errorMsg}</p>}
        </div>
      </main>
    );
  }

  if (step === "role") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 py-6">
        <div className="flex w-full max-w-sm flex-col items-center">
          <h2 className="mb-6 text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
            I am a...
          </h2>

          <TouchSwipe
            onSwipeLeft={() => setRole("seed")}
            onSwipeRight={() => setRole("core")}
          >
            <div className="flex w-full flex-col gap-4">
              <button
                type="button"
                onClick={() => setRole("core")}
                className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
                  role === "core"
                    ? "border-[var(--accent)] bg-white shadow-md"
                    : "border-[var(--line)] bg-white/60"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg font-bold text-[var(--foreground)]">Core</span>
                  {role === "core" && (
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  You own a soulbound NFT that levels up as Seeds join. Nominate up to 5 of your
                  EOAs as Seeds. Each Seed that accepts adds a level (1→5). The higher the level,
                  the stronger your onchain proof — perfect for airdrop eligibility.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole("seed")}
                className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
                  role === "seed"
                    ? "border-[var(--accent)] bg-white shadow-md"
                    : "border-[var(--line)] bg-white/60"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg font-bold text-[var(--foreground)]">Seed</span>
                  {role === "seed" && (
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  A Core nominated you. By minting, you accept the link and the Core&apos;s NFT
                  evolves. Your EOA is recorded onchain as part of that Core&apos;s identity. No
                  tokens land in your wallet — just an immutable record.
                </p>
              </button>
            </div>
          </TouchSwipe>

          <p className="mt-4 text-center text-xs text-[var(--muted)]">
            Swipe left for Seed, right for Core
          </p>

          <button
            type="button"
            onClick={() => setStep(role)}
            className="mt-6 h-14 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-4 text-sm font-semibold text-white"
          >
            Continue as {role === "core" ? "Core" : "Seed"}
          </button>
        </div>
      </main>
    );
  }

  // ---- CORE VIEW ----
  if (step === "core") {
    return (
      <main className="flex min-h-screen items-start justify-center bg-[var(--surface)] px-4 py-6">
        <div className="flex w-full max-w-sm flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">Core</h2>
              <p className="text-xs text-[var(--muted)]">{shortenAddress(address ?? "0x")}</p>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)]"
            >
              Disconnect
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white p-4 text-center">
            <p className="text-3xl font-bold text-[var(--accent)]">Level {coreState.seedCount}</p>
            <p className="text-xs text-[var(--muted)]">/ 5 MAX</p>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-[var(--line)] bg-white p-2">
              <p className="font-semibold text-[var(--foreground)]">{coreState.seedCount}</p>
              <p className="text-[var(--muted)]">Minted</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-2">
              <p className="font-semibold text-[var(--foreground)]">{coreState.pendingCount}</p>
              <p className="text-[var(--muted)]">Pending</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white p-2">
              <p className="font-semibold text-[var(--foreground)]">{slotsFree}</p>
              <p className="text-[var(--muted)]">Free</p>
            </div>
          </div>

          {slotsFree > 0 && (
            <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">Nominate Seeds</p>
              <div className="flex flex-col gap-2">
                {nominateInputs.map((val, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => updateInput(i, e.target.value)}
                      placeholder={`Seed ${i + 1} address (0x...)`}
                      className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                      maxLength={42}
                    />
                    {nominateInputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInput(i)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-xs text-red-400"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                {nominateInputs.length < Math.min(5, slotsFree) && (
                  <button
                    type="button"
                    onClick={addInputField}
                    className="h-9 flex-1 rounded-xl border border-dashed border-[var(--line)] text-xs text-[var(--muted)]"
                  >
                    + Add seed
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNominate}
                  disabled={isWorking}
                  className="h-9 flex-1 rounded-xl bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isWorking ? "..." : "Nominate"}
                </button>
              </div>
            </div>
          )}

          {status && <p className="mb-2 text-center text-xs text-[var(--muted)]">{status}</p>}
          {errorMsg && <p className="mb-2 text-center text-xs text-red-500">{errorMsg}</p>}

          <button
            type="button"
            onClick={() => setStep("role")}
            className="mt-4 text-xs text-[var(--muted)] underline"
          >
            &larr; Change role
          </button>
        </div>
      </main>
    );
  }

  // ---- SEED VIEW ----
  return (
    <main className="flex min-h-screen items-start justify-center bg-[var(--surface)] px-4 py-6">
      <div className="flex w-full max-w-sm flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Seed</h2>
            <p className="text-xs text-[var(--muted)]">{shortenAddress(address ?? "0x")}</p>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)]"
          >
            Disconnect
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
            Check your nomination
          </p>
          <input
            type="text"
            value={seedCoreAddress}
            onChange={(e) => setSeedCoreAddress(e.target.value)}
            placeholder="Core address (0x...)"
            className="mb-3 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            maxLength={42}
          />
          <button
            type="button"
            onClick={handleCheckNomination}
            disabled={isWorking}
            className="h-10 w-full rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            {isWorking ? "..." : "Check"}
          </button>
        </div>

        {seedCoreAddress.length === 42 && (
          <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">Accept the link</p>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Mint to core: {shortenAddress(seedCoreAddress)}
            </p>
            <button
              type="button"
              onClick={handleMint}
              disabled={isWorking}
              className="h-12 w-full rounded-[1.1rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] text-sm font-semibold text-white disabled:opacity-50"
            >
              {isWorking ? "Minting..." : "Mint & Accept"}
            </button>
          </div>
        )}

        {status && <p className="mb-2 text-center text-xs text-[var(--muted)]">{status}</p>}
        {errorMsg && <p className="mb-2 text-center text-xs text-red-500">{errorMsg}</p>}

        <button
          type="button"
          onClick={() => setStep("role")}
          className="mt-4 text-xs text-[var(--muted)] underline"
        >
          &larr; Change role
        </button>
      </div>
    </main>
  );
}
