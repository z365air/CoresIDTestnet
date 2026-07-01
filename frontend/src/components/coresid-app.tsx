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
import { getConnectorClient, readContract } from "@wagmi/core";
import { wagmiConfig } from "@/lib/wagmi-config";
import {
  CORESID_CONTRACT_ADDRESS,
  CORESID_ABI,
  CORESID_CHAIN_ID,
  CORESID_CHAIN,
  CORESID_TX_URL,
  shortenAddress,
} from "@/lib/coresid";


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
    const customErr = msg.match(/custom error '([^']+)'/);
    if (customErr) return customErr[1].replace(/([a-z])([A-Z])/g, "$1 $2");
    const reasonStr = msg.match(/reason string '([^']+)'/);
    if (reasonStr) return reasonStr[1];
    const reason = msg.match(/reason: ([^\n]+)/);
    if (reason) return reason[1].trim();
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
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const threshold = 30;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (e.deltaX > threshold) onSwipeLeft();
        else if (e.deltaX < -threshold) onSwipeRight();
      } else {
        if (e.deltaY > threshold) onSwipeLeft();
        else if (e.deltaY < -threshold) onSwipeRight();
      }
    },
    [onSwipeLeft, onSwipeRight],
  );
  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onWheel={onWheel}>
      {children}
    </div>
  );
}

// --------------------------------------------------------------------------

export function CoresIDApp() {
  const { address, isConnected } = useAccount();
  const chainIdConnected = useChainId();
  const isOnWrongChain = chainIdConnected !== CORESID_CHAIN_ID;
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
  const [seedErrors, setSeedErrors] = useState<(string | null)[]>([null]);
  const [pendingSeeds, setPendingSeeds] = useState<Address[]>([]);
  const [linkedSeeds, setLinkedSeeds] = useState<Address[]>([]);
  const [nominatedStatus, setNominatedStatus] = useState<string>("");
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastTxLabel, setLastTxLabel] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Seed state
  const [seedCoreAddress, setSeedCoreAddress] = useState("");
  const [linkedCore, setLinkedCore] = useState<Address | null>(null);

  // ---- seed address validation ----
  const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
  const validateNonce = useRef(0);
  useEffect(() => {
    const nonce = ++validateNonce.current;
    const results = nominateInputs.map(() => null as string | null);
    setSeedErrors(results);

    nominateInputs.forEach((raw, i) => {
      const addr = raw.trim();
      if (!addr) return;
      if (addr.length === 42 && addr.startsWith("0x") && !EVM_RE.test(addr)) {
        setSeedErrors((prev) => {
          const next = [...prev];
          next[i] = "Not a valid EVM address";
          return next;
        });
        return;
      }
      if (addr.length !== 42 || !addr.startsWith("0x")) return;

      (async () => {
        try {
          const linked = (await readContract(wagmiConfig, {
            address: CORESID_CONTRACT_ADDRESS,
            abi: CORESID_ABI,
            functionName: "coreOfSeed",
            args: [addr as Address],
          })) as Address;
          if (nonce !== validateNonce.current) return;
          const nullAddr = "0x0000000000000000000000000000000000000000";
          if (linked !== nullAddr) {
            setSeedErrors((prev) => {
              const next = [...prev];
              next[i] = `Already linked to ${shortenAddress(linked)}`;
              return next;
            });
          }
        } catch {
          // ignore
        }
      })();
    });
  }, [nominateInputs]);

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
  const switchAttempted = useRef(false);

  async function ensureCorrectChain(overrideChainId?: number) {
    const currentChainId = overrideChainId ?? chainIdConnected;
    if (currentChainId === CORESID_CHAIN_ID) return;
    // try switch; if it fails for any reason, try wallet_addEthereumChain as fallback
    const switchOrAdd = async (): Promise<boolean> => {
      try {
        await switchChainAsync({ chainId: CORESID_CHAIN_ID });
        return true;
      } catch {
        // switch failed – try adding the chain
        try {
          await (window as any).ethereum?.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: `0x${(CORESID_CHAIN_ID as number).toString(16)}`,
              chainName: CORESID_CHAIN.name,
              nativeCurrency: CORESID_CHAIN.nativeCurrency,
              rpcUrls: CORESID_CHAIN.rpcUrls,
              blockExplorerUrls: CORESID_CHAIN.blockExplorerUrls,
            }],
          });
          // after adding, try switching again
          await switchChainAsync({ chainId: CORESID_CHAIN_ID });
          return true;
        } catch {
          return false;
        }
      }
    };
    const ok = await switchOrAdd();
    if (!ok) {
      setErrorMsg("Please switch your wallet to Base Sepolia (chain 84532).");
    }
  }

  const ensureChain = useCallback(async (client?: EIP1193Provider) => {
    const actualChainId = client
      ? Number(await client.request({ method: "eth_chainId" }))
      : chainIdConnected;
    if (actualChainId !== CORESID_CHAIN_ID) {
      await ensureCorrectChain(actualChainId);
    }
  }, [chainIdConnected]);

  useEffect(() => {
    if (isConnected && isOnWrongChain && !switchAttempted.current) {
      switchAttempted.current = true;
      ensureCorrectChain();
    }
    if (!isOnWrongChain) {
      switchAttempted.current = false;
    }
  }, [isConnected, isOnWrongChain]);

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
      await ensureChain(client as unknown as EIP1193Provider);
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
      await ensureChain(client as unknown as EIP1193Provider);
      setStatus("Connected with browser wallet.");
      setStep("role");
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Wallet connection failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    setStep("connect");
    setCoreState({ seedCount: 0, pendingCount: 0, tokenId: null });
    setNominateInputs([""]);
    setPendingSeeds([]);
    setLinkedSeeds([]);
    setSeedCoreAddress("");
    setNominatedStatus("");
    setErrorMsg(null);
  }

  // ---- check if seed is already linked (auto-check on mount) ----
  useEffect(() => {
    if (!address || step !== "seed") {
      setLinkedCore(null);
      return;
    }
    const check = async () => {
      try {
        const linked = (await readContract(wagmiConfig, {
          address: CORESID_CONTRACT_ADDRESS,
          abi: CORESID_ABI,
          functionName: "coreOfSeed",
          args: [address as Address],
        })) as Address;
        setLinkedCore(linked !== "0x0000000000000000000000000000000000000000" ? linked : null);
      } catch {
        setLinkedCore(null);
      }
    };
    check();
  }, [address, step, refreshKey]);

  // ---- clear transient status when navigating between views ----
  useEffect(() => {
    setStatus("");
    setErrorMsg(null);
    setLastTxHash(null);
  }, [step]);

  // ---- carousel opens at the user's current level ----
  useEffect(() => {
    if (step === "core") {
      setCarouselIdx(coreState.seedCount);
    }
  }, [step, coreState.seedCount]);

  // ---- clear local state when wallet changes ----
  useEffect(() => {
    setPendingSeeds([]);
    setLinkedSeeds([]);
    setNominatedStatus("");
    setCoreState({ seedCount: 0, pendingCount: 0, tokenId: null });
    setLinkedCore(null);
    setNominateInputs([""]);
    setSeedErrors([null]);
    setStatus("");
    setErrorMsg(null);
    setLastTxHash(null);
  }, [address]);

  // ---- reset nominated status when input address changes ----
  const prevInputAddr = useRef("");
  useEffect(() => {
    if (prevInputAddr.current && seedCoreAddress !== prevInputAddr.current) {
      setNominatedStatus("");
    }
    prevInputAddr.current = seedCoreAddress;
  }, [seedCoreAddress]);

  // ---- read core state + pending seeds from chain ----
  useEffect(() => {
    if (!address || step !== "core") {
      setPendingSeeds([]);
      return;
    }

    const fetchAll = async () => {
      try {
        const coreAddr = address as Address;

        const [seedCount, coreTokenId, pendingSeeds, linkedSeeds] = await Promise.all([
          readContract(wagmiConfig, {
            address: CORESID_CONTRACT_ADDRESS,
            abi: CORESID_ABI,
            functionName: "seedCount",
            args: [coreAddr],
          }),
          readContract(wagmiConfig, {
            address: CORESID_CONTRACT_ADDRESS,
            abi: CORESID_ABI,
            functionName: "coreTokenId",
            args: [coreAddr],
          }),
          readContract(wagmiConfig, {
            address: CORESID_CONTRACT_ADDRESS,
            abi: CORESID_ABI,
            functionName: "getPendingSeeds",
            args: [coreAddr],
          }) as Promise<Address[]>,
          readContract(wagmiConfig, {
            address: CORESID_CONTRACT_ADDRESS,
            abi: CORESID_ABI,
            functionName: "getLinkedSeeds",
            args: [coreAddr],
          }) as Promise<Address[]>,
        ]);

        setCoreState({
          seedCount: Number(seedCount),
          pendingCount: pendingSeeds.length,
          tokenId: Number(coreTokenId),
        });
        setPendingSeeds(pendingSeeds);
        setLinkedSeeds(linkedSeeds);
      } catch {
        // contract not yet interacted with — fine
      }
    };

    fetchAll();
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

      const tx = await writeContractAsync({
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "nominate",
        args: [validAddresses],
      });

      setLastTxHash(tx);
      setLastTxLabel("Nominate");
      setStatus("Nominated successfully!");
      setNominateInputs([""]);
      setPendingSeeds((prev) => [...prev, ...validAddresses]);
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
      const tx = await writeContractAsync({
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "cancelNomination",
        args: [seed],
      });

      setLastTxHash(tx);
      setLastTxLabel("Cancel");
      setStatus("Nomination cancelled.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Cancel failed.");
    } finally {
      setIsWorking(false);
    }
  }

  // ---- revoke linked seed ----
  async function handleRevoke(seed: Address) {
    setErrorMsg(null);
    setIsWorking(true);
    setStatus("Revoking seed...");
    try {
      await ensureChain();
      const tx = await writeContractAsync({
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "revoke",
        args: [seed],
      });

      setLastTxHash(tx);
      setLastTxLabel("Revoke");
      setStatus("Seed revoked. Level decreased.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Revoke failed.");
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
      const tx = await writeContractAsync({
        address: CORESID_CONTRACT_ADDRESS,
        abi: CORESID_ABI,
        functionName: "mint",
        args: [coreAddr],
      });
      setLastTxHash(tx);
      setLastTxLabel("Mint");
      setStatus("Minted! NFT leveled up on the core.");
      setNominatedStatus("linked");
      setLinkedCore(coreAddr);
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
    setNominatedStatus("");
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
          setNominatedStatus("nominated");
        } else {
          setStatus("You are already linked to this core.");
          setNominatedStatus("linked");
        }
      } else {
        if (linked !== nullAddr) {
          setStatus(`You are already linked to core ${shortenAddress(linked)}.`);
          setNominatedStatus("linked");
        } else {
          setStatus("You are not nominated by this core.");
          setNominatedStatus("");
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
    setSeedErrors((prev) => {
      const nextErr = [...prev];
      nextErr[index] = null;
      return nextErr;
    });
  }

  function removeInput(index: number) {
    if (nominateInputs.length > 1) {
      setNominateInputs(nominateInputs.filter((_, i) => i !== index));
    }
  }

  // ---- render ----
  const slotsFree = 5 - (coreState.seedCount + coreState.pendingCount);

  if (step === "connect") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 py-6">
        <div className="flex w-full max-w-sm flex-col items-center">
          <img
            src="/baselogomid.png"
            alt="Base Cores ID"
            className="mb-6 w-48"
          />
          <h1 className="text-center text-3xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
            Base Cores ID
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
              <p className="text-xs text-[var(--muted)]">Switching to Base Sepolia...</p>
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
            <div className="w-full">
              <div className="relative w-full overflow-hidden rounded-[1.5rem]">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(${role === "core" ? "0%" : "-100%"})` }}
                >
                  <div className="w-full flex-shrink-0">
                    <img
                      src="/images/CORE.png"
                      alt="Core"
                      className="w-full object-contain"
                    />
                  </div>
                  <div className="w-full flex-shrink-0">
                    <img
                      src="/images/SEED.png"
                      alt="Seed"
                      className="w-full object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-center gap-2">
                <span
                  className={`h-2 rounded-full transition-all ${
                    role === "core" ? "w-5 bg-[var(--accent)]" : "w-2 bg-[var(--line)]"
                  }`}
                />
                <span
                  className={`h-2 rounded-full transition-all ${
                    role === "seed" ? "w-5 bg-[var(--accent)]" : "w-2 bg-[var(--line)]"
                  }`}
                />
              </div>

              <p className="mt-3 text-center text-xs text-[var(--muted)]">
                Scroll or swipe to switch
              </p>
            </div>
          </TouchSwipe>

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
    const level = coreState.seedCount;

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
              className="rounded-xl border border-[var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)] backdrop-blur-xl"
            >
              Disconnect
            </button>
          </div>

          {level >= 0 ? (
            <div className="group relative mb-4 overflow-hidden rounded-[1.5rem] border border-[rgba(41,83,255,0.15)] bg-white shadow-[0_8px_40px_rgba(27,67,255,0.08)] transition-all">
              <div
                className="flex"
                style={{
                  transform: `translateX(-${carouselIdx * 100}%)`,
                  transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                {[0,1,2,3,4,5].map((i) => {
                  const locked = i > level;
                  return (
                    <div key={i} className="relative w-full flex-shrink-0">
                      <img
                        src={`/metadata/level${i}.png`}
                        alt={`Level ${i}`}
                        className={`w-full object-contain ${locked ? "grayscale" : ""}`}
                        style={locked ? { filter: "grayscale(1)" } : undefined}
                      />
                      {locked ? (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(12,19,48,0.72)] to-transparent p-4 pt-12">
                          <p className="text-lg font-bold text-white/40">Level {i}</p>
                        </div>
                      ) : (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[rgba(12,19,48,0.72)] to-transparent p-4 pt-12">
                          <div className="flex items-end justify-between">
                            <p className="text-2xl font-bold text-white">Level {i}</p>
                            <p className="text-sm font-semibold text-white/80">{i}/5</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* share button */}
              <button
                type="button"
                onClick={() => {
                  const text = `I have connected ${level} Seeds to my Core on Base Cores ID\nYou can now link your EOAs and agents to your @baseapp account`;
                  const shareUrl = `https://coresid.vercel.app/share/${level}`;
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
                className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow backdrop-blur-sm transition-all hover:bg-white hover:shadow-md z-10"
                aria-label="Share on X"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-[var(--ink)]">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>

              {/* left arrow */}
              <button
                type="button"
                onClick={() => setCarouselIdx(Math.max(0, carouselIdx - 1))}
                className={`absolute top-1/2 -translate-y-1/2 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-transparent backdrop-blur-sm transition-all hover:bg-white/90 hover:border-white/90 ${carouselIdx === 0 ? "hidden" : ""}`}
                aria-label="Previous"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-white/70 transition-colors group-hover:fill-[var(--ink)]">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>

              {/* right arrow */}
              <button
                type="button"
                onClick={() => setCarouselIdx(Math.min(5, carouselIdx + 1))}
                className={`absolute top-1/2 -translate-y-1/2 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-transparent backdrop-blur-sm transition-all hover:bg-white/90 hover:border-white/90 ${carouselIdx === 5 ? "hidden" : ""}`}
                aria-label="Next"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-white/70 transition-colors group-hover:fill-[var(--ink)]">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>

              {/* dots */}
              <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5">
                {[0,1,2,3,4,5].map((i) => {
                  const locked = i > level;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => !locked && setCarouselIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        locked
                          ? "w-1.5 cursor-default bg-white/15"
                          : carouselIdx === i
                          ? "w-4 bg-white"
                          : "w-1.5 bg-white/35 hover:bg-white/60"
                      }`}
                      aria-label={`Level ${i}`}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-1">
              {Array.from({ length: 5 }, (_, i) => {
                let state: "filled" | "pending" | "empty";
                if (i < level) state = "filled";
                else if (i < level + coreState.pendingCount) state = "pending";
                else state = "empty";

                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-3 w-full rounded-full transition-all ${
                        state === "filled"
                          ? "bg-[var(--accent)] shadow-[0_0_8px_rgba(41,83,255,0.35)]"
                          : state === "pending"
                          ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.35)]"
                          : "bg-[var(--line)]"
                      }`}
                    />
                    <span
                      className={`text-[10px] ${
                        state === "filled"
                          ? "text-[var(--accent)]"
                          : state === "pending"
                          ? "text-amber-500"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {state === "filled"
                        ? "✓"
                        : state === "pending"
                        ? "○"
                        : "○"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-around text-[10px] text-[var(--muted)]">
              <span>{level} minted</span>
              <span>{coreState.pendingCount} pending</span>
              <span>{slotsFree} free</span>
            </div>
          </div>

          {pendingSeeds.length > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 backdrop-blur-xl">
              <p className="mb-2 text-sm font-semibold text-amber-800">
                Pending Seeds
              </p>
              <div className="flex flex-col gap-2">
                {pendingSeeds.map((seed) => (
                  <div key={seed} className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-700">
                      {shortenAddress(seed)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCancelNomination(seed)}
                      disabled={isWorking}
                      className="rounded-lg border border-amber-300/60 bg-white/60 px-2 py-1 text-[10px] font-medium text-amber-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {linkedSeeds.length > 0 && (
            <div className="mb-4 rounded-2xl border border-green-200/60 bg-green-50/60 p-4 backdrop-blur-xl">
              <p className="mb-2 text-sm font-semibold text-green-800">
                Linked Seeds
              </p>
              <div className="flex flex-col gap-2">
                {linkedSeeds.map((seed) => (
                  <div key={seed} className="flex items-center justify-between">
                    <span className="text-xs font-mono text-green-700">
                      {shortenAddress(seed)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRevoke(seed)}
                      disabled={isWorking}
                      className="rounded-lg border border-red-300/60 bg-white/60 px-2 py-1 text-[10px] font-medium text-red-600 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {slotsFree > 0 && (
            <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4 backdrop-blur-xl">
              <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                Nominate Seeds
              </p>
              {coreState.tokenId === null || coreState.tokenId === 0 ? (
                <p className="mb-3 text-xs text-[var(--muted)]">
                  By nominating your first seeds, you will receive the base CoresID NFT.
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                  {nominateInputs.map((val, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => updateInput(i, e.target.value)}
                          placeholder={`Seed ${i + 1} address (0x...)`}
                          className={`h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-xs text-[var(--foreground)] font-mono outline-none ${
                            seedErrors[i]
                              ? "border-red-400 focus:border-red-500"
                              : "border-[var(--line)] focus:border-[var(--accent)]"
                          }`}
                          maxLength={42}
                        />
                        {seedErrors[i] && (
                          <p className="mt-1 text-[10px] leading-tight text-red-500">
                            {seedErrors[i]}
                          </p>
                        )}
                      </div>
                      {nominateInputs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInput(i)}
                          className="mt-0 flex h-8 w-8 items-center justify-center self-start rounded-lg border border-red-200 bg-white/60 text-xs text-red-400"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                {nominateInputs.length < Math.min(5, slotsFree) && (
                  <button
                    type="button"
                    onClick={addInputField}
                    className="h-9 flex-1 rounded-xl border border-dashed border-[var(--line)] text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    + Add seed
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNominate}
                  disabled={isWorking || seedErrors.some(Boolean)}
                  className="h-9 flex-1 rounded-xl bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-3 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(41,83,255,0.25)] transition-all hover:shadow-[0_4px_24px_rgba(41,83,255,0.35)] disabled:opacity-50"
                >
                  {isWorking ? "..." : "Nominate"}
                </button>
              </div>
            </div>
          )}

          {coreState.tokenId !== null && coreState.tokenId !== 0 && (
            <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4 text-center backdrop-blur-xl">
              <p className="text-[10px] text-[var(--muted)]">Token ID</p>
              <p className="text-sm font-mono font-bold text-[var(--foreground)]">
                #{coreState.tokenId}
              </p>
            </div>
          )}

          {status && (
            <p className="mb-2 text-center text-xs text-[var(--muted)]">{status}</p>
          )}
          {errorMsg && (
            <p className="mb-2 text-center text-xs text-red-500">{errorMsg}</p>
          )}
          {lastTxHash && (
            <a
              href={CORESID_TX_URL(lastTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 block text-center text-xs text-blue-500 underline"
            >
              View {lastTxLabel} tx on Basescan &rarr;
            </a>
          )}

          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setStep("role")}
              className="text-xs text-[var(--muted)] underline transition-colors hover:text-[var(--accent)]"
            >
              &larr; Change role
            </button>
          </div>
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
            className="rounded-xl border border-[var(--line)] bg-white/60 px-3 py-1.5 text-xs font-medium text-[var(--muted)] backdrop-blur-xl"
          >
            Disconnect
          </button>
        </div>

        {linkedCore ? (
          <div className="mb-4 rounded-2xl border border-green-200/60 bg-green-50/60 p-6 text-center backdrop-blur-xl">
            <p className="text-sm font-semibold text-green-700">
              You are now linked to
            </p>
            <p className="mt-2 font-mono text-sm font-medium text-green-800 break-all">
              {linkedCore}
            </p>
            <p className="mt-2 text-xs text-green-600">
              Linked onchain.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4 backdrop-blur-xl">
              <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">
                Check your nomination
              </p>
              <input
                type="text"
                value={seedCoreAddress}
                onChange={(e) => setSeedCoreAddress(e.target.value)}
                placeholder="Core address (0x...)"
                className="mb-3 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs text-[var(--foreground)] font-mono outline-none focus:border-[var(--accent)]"
                maxLength={42}
              />
              <button
                type="button"
                onClick={handleCheckNomination}
                disabled={isWorking}
                className="h-10 w-full rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              >
                {isWorking ? "..." : "Check"}
              </button>
            </div>

            {seedCoreAddress.length === 42 && nominatedStatus === "nominated" && (
              <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4 backdrop-blur-xl">
                <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">Accept the link</p>
                <p className="mb-3 text-xs text-[var(--muted)]">
                  Mint to core:{" "}
                  <span className="font-mono font-medium text-[var(--foreground)]">
                    {shortenAddress(seedCoreAddress)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleMint}
                  disabled={isWorking}
                  className="h-12 w-full rounded-[1.1rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] text-sm font-semibold text-white shadow-[0_4px_20px_rgba(41,83,255,0.3)] transition-all hover:shadow-[0_4px_28px_rgba(41,83,255,0.4)] disabled:opacity-50"
                >
                  {isWorking ? "Minting..." : "Mint & Accept"}
                </button>
              </div>
            )}

            {status && (
              <div className="mb-2 rounded-xl border border-[var(--line)] bg-white/60 p-3 text-center backdrop-blur-xl">
                <p className="text-xs text-[var(--muted)]">{status}</p>
              </div>
            )}
            {errorMsg && <p className="mb-2 text-center text-xs text-red-500">{errorMsg}</p>}
            {lastTxHash && (
              <a
                href={CORESID_TX_URL(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 block text-center text-xs text-blue-500 underline"
              >
                View {lastTxLabel} tx on Basescan &rarr;
              </a>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => setStep("role")}
          className="mt-2 text-xs text-[var(--muted)] underline transition-colors hover:text-[var(--accent)]"
        >
          &larr; Change role
        </button>
      </div>
    </main>
  );
}
