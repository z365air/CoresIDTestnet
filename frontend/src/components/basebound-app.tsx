"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import {
  type Address,
  type Hex,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
} from "viem";
import { baseSepolia } from "viem/chains";
import { StaticCover } from "@/components/static-cover";
import {
  BASEBOUND_ABI,
  BASEBOUND_CHAIN_ID,
  BASEBOUND_CONTRACT_ADDRESS,
  EAS_ABI,
  EAS_CONTRACT_ADDRESS,
  EAS_SCHEMA_UID,
  ProposalStatus,
  isSchemaConfigured,
  shortenAddress,
} from "@/lib/basebound";

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type Mode = "source" | "target";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

function errMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const r = error as Record<string, unknown>;
    if (typeof r.shortMessage === "string") return r.shortMessage;
    if (typeof r.message === "string") return r.message;
  }
  return "Something went wrong.";
}

export function BaseBoundApp() {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();

  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode>("source");
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Waiting for client hydration...");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<Hex | null>(null);

  // Source-mode state
  const [targetInput, setTargetInput] = useState("");
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [sourceTargetStatus, setSourceTargetStatus] = useState<number | null>(null);

  // Target-mode state
  const [sourceInput, setSourceInput] = useState("");
  const [targetBalance, setTargetBalance] = useState<number | null>(null);
  const [targetSourceStatus, setTargetSourceStatus] = useState<number | null>(null);

  const account = address ? getAddress(address) : null;

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

  const normalizedTarget = useMemo(() => {
    const v = targetInput.trim();
    return isAddress(v) ? getAddress(v) : null;
  }, [targetInput]);

  const normalizedSource = useMemo(() => {
    const v = sourceInput.trim();
    return isAddress(v) ? getAddress(v) : null;
  }, [sourceInput]);

  const chainReady = walletChainId === BASEBOUND_CHAIN_ID;

  useEffect(() => {
    const t = window.setTimeout(() => {
      setHydrated(true);
      setStatus("Ready. Sign in with Base to begin.");
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const updateChainState = useCallback(async (p: Eip1193Provider) => {
    const hex = (await p.request({ method: "eth_chainId" })) as Hex;
    setWalletChainId(Number.parseInt(hex, 16));
  }, []);

  useEffect(() => {
    if (!isConnected || !account || !connector) return;
    let cancelled = false;
    (async () => {
      try {
        const p = (await connector.getProvider()) as Eip1193Provider | undefined;
        if (!p || cancelled) return;
        setProvider(p);
        await updateChainState(p);
      } catch {
        if (!cancelled) setProvider(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, connector, isConnected, updateChainState]);

  // Refresh on-chain reads relevant to the active mode.
  const refreshReads = useCallback(async () => {
    if (!account) return;
    try {
      if (mode === "source") {
        const count = (await publicClient.readContract({
          address: BASEBOUND_CONTRACT_ADDRESS,
          abi: BASEBOUND_ABI,
          functionName: "activeCount",
          args: [account],
        })) as bigint;
        setActiveCount(Number(count));
        if (normalizedTarget) {
          const s = (await publicClient.readContract({
            address: BASEBOUND_CONTRACT_ADDRESS,
            abi: BASEBOUND_ABI,
            functionName: "proposalStatus",
            args: [account, normalizedTarget],
          })) as number;
          setSourceTargetStatus(Number(s));
        } else {
          setSourceTargetStatus(null);
        }
      } else {
        const bal = (await publicClient.readContract({
          address: BASEBOUND_CONTRACT_ADDRESS,
          abi: BASEBOUND_ABI,
          functionName: "balanceOf",
          args: [account],
        })) as bigint;
        setTargetBalance(Number(bal));
        if (normalizedSource) {
          const s = (await publicClient.readContract({
            address: BASEBOUND_CONTRACT_ADDRESS,
            abi: BASEBOUND_ABI,
            functionName: "proposalStatus",
            args: [normalizedSource, account],
          })) as number;
          setTargetSourceStatus(Number(s));
        } else {
          setTargetSourceStatus(null);
        }
      }
    } catch {
      /* reads are best-effort */
    }
  }, [account, mode, normalizedSource, normalizedTarget]);

  useEffect(() => {
    void refreshReads();
  }, [refreshReads]);

  async function handleLogin() {
    setIsSigningIn(true);
    setErrorMsg(null);
    setStatus("Opening Base Account...");
    try {
      if (!baseConnector) throw new Error("Base Account connector unavailable.");
      await connectAsync({ connector: baseConnector });
      const p = (await baseConnector.getProvider()) as Eip1193Provider | undefined;
      if (!p) throw new Error("Base provider unavailable.");
      setProvider(p);
      await updateChainState(p);
      setStatus("Signed in with Base.");
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Base login failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleInjectedLogin() {
    setIsSigningIn(true);
    setErrorMsg(null);
    setStatus("Opening browser wallet...");
    try {
      if (!injectedConnector) {
        throw new Error("No injected wallet (Rabby/MetaMask) detected.");
      }
      await connectAsync({ connector: injectedConnector });
      const p = (await injectedConnector.getProvider()) as
        | Eip1193Provider
        | undefined;
      if (!p) throw new Error("Injected provider unavailable.");
      setProvider(p);
      await updateChainState(p);
      setStatus("Connected with browser wallet.");
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Wallet connection failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSwitch() {
    try {
      setStatus("Switching to Base Sepolia...");
      await switchChainAsync({ chainId: BASEBOUND_CHAIN_ID });
      if (provider) await updateChainState(provider);
      setStatus("Switched to Base Sepolia.");
    } catch (error) {
      setErrorMsg(errMessage(error));
    }
  }

  async function sendTx(data: Hex, to: Address = BASEBOUND_CONTRACT_ADDRESS) {
    if (!provider || !account) throw new Error("Wallet not ready.");
    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to, data }],
    })) as Hex;
    return hash;
  }

  async function waitFor(hash: Hex) {
    setLastTx(hash);
    await publicClient.waitForTransactionReceipt({ hash });
  }

  // ----- Source actions -----
  async function handlePropose() {
    if (!account || !normalizedTarget || !chainReady) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      setStatus("Confirm the proposal in Base Account...");
      const data = encodeFunctionData({
        abi: BASEBOUND_ABI,
        functionName: "propose",
        args: [normalizedTarget],
      });
      const hash = await sendTx(data);
      setStatus("Proposal submitted. Waiting for confirmation...");
      await waitFor(hash);
      setStatus("Proposed. Share with the target so they can claim.");
      await refreshReads();
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Proposal failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!account || !normalizedTarget || !chainReady) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      setStatus("Confirm cancellation...");
      const data = encodeFunctionData({
        abi: BASEBOUND_ABI,
        functionName: "cancelProposal",
        args: [normalizedTarget],
      });
      const hash = await sendTx(data);
      setStatus("Cancelling. Waiting for confirmation...");
      await waitFor(hash);
      setStatus("Proposal cancelled. Slot freed.");
      await refreshReads();
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Cancellation failed.");
    } finally {
      setBusy(false);
    }
  }

  // ----- Target actions: claim, then attest via EAS -----
  async function handleClaimAndAttest() {
    if (!account || !normalizedSource || !chainReady) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      // Step 1: claim the NFT.
      setStatus("Confirm the claim in your wallet...");
      const claimData = encodeFunctionData({
        abi: BASEBOUND_ABI,
        functionName: "claim",
        args: [normalizedSource],
      });
      const claimHash = await sendTx(claimData);
      setStatus("Claim submitted. Waiting for confirmation...");
      await waitFor(claimHash);

      // Read the tokenId just minted (balance-based: target holds exactly 1).
      let tokenId = 0n;
      try {
        // Find the token by scanning Claimed events for this pair is overkill;
        // sourceOf is keyed by tokenId. Easiest: read nextTokenId not exposed,
        // so we rely on the Claimed event from the receipt instead.
        const receipt = await publicClient.getTransactionReceipt({
          hash: claimHash,
        });
        // Claimed(source, target, tokenId): tokenId is the 3rd indexed topic.
        const claimedLog = receipt.logs.find(
          (l) =>
            l.address.toLowerCase() ===
            BASEBOUND_CONTRACT_ADDRESS.toLowerCase(),
        );
        if (claimedLog && claimedLog.topics[3]) {
          tokenId = BigInt(claimedLog.topics[3]);
        }
      } catch {
        /* fall back to 0 */
      }

      // Step 2: write the EAS attestation of the link.
      if (!isSchemaConfigured()) {
        setStatus(
          "Claimed. (EAS schema not configured - skipped attestation.)",
        );
        await refreshReads();
        return;
      }

      setStatus("Claimed. Now confirm the attestation...");
      const encodedData = encodeAbiParameters(
        [
          { name: "source", type: "address" },
          { name: "target", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "role", type: "string" },
        ],
        [normalizedSource, account, tokenId, "basebound-link"],
      );

      const attestData = encodeFunctionData({
        abi: EAS_ABI,
        functionName: "attest",
        args: [
          {
            schema: EAS_SCHEMA_UID,
            data: {
              recipient: normalizedSource,
              expirationTime: 0n,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: encodedData,
              value: 0n,
            },
          },
        ],
      });
      const attestHash = await sendTx(attestData, EAS_CONTRACT_ADDRESS);
      setStatus("Attestation submitted. Waiting for confirmation...");
      await waitFor(attestHash);
      setStatus("Linked! You hold a BaseBoundID and an onchain attestation.");
      await refreshReads();
    } catch (error) {
      setErrorMsg(errMessage(error));
      setStatus("Claim/attest failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BaseBoundUI
      hydrated={hydrated}
      mode={mode}
      setMode={setMode}
      isConnected={isConnected}
      isConnecting={isConnecting}
      isSigningIn={isSigningIn}
      account={account}
      chainReady={chainReady}
      walletChainId={walletChainId}
      isSwitching={isSwitching}
      busy={busy}
      status={status}
      errorMsg={errorMsg}
      lastTx={lastTx}
      targetInput={targetInput}
      setTargetInput={setTargetInput}
      sourceInput={sourceInput}
      setSourceInput={setSourceInput}
      normalizedTarget={normalizedTarget}
      normalizedSource={normalizedSource}
      activeCount={activeCount}
      sourceTargetStatus={sourceTargetStatus}
      targetBalance={targetBalance}
      targetSourceStatus={targetSourceStatus}
      onLogin={handleLogin}
      onInjectedLogin={handleInjectedLogin}
      hasInjected={Boolean(injectedConnector)}
      onSwitch={handleSwitch}
      onDisconnect={() => {
        disconnect();
        setProvider(null);
        setWalletChainId(null);
        setStatus("Disconnected.");
      }}
      onPropose={handlePropose}
      onCancel={handleCancel}
      onClaim={handleClaimAndAttest}
    />
  );
}

type UIProps = {
  hydrated: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  isConnected: boolean;
  isConnecting: boolean;
  isSigningIn: boolean;
  account: Address | null;
  chainReady: boolean;
  walletChainId: number | null;
  isSwitching: boolean;
  busy: boolean;
  status: string;
  errorMsg: string | null;
  lastTx: Hex | null;
  targetInput: string;
  setTargetInput: (v: string) => void;
  sourceInput: string;
  setSourceInput: (v: string) => void;
  normalizedTarget: Address | null;
  normalizedSource: Address | null;
  activeCount: number | null;
  sourceTargetStatus: number | null;
  targetBalance: number | null;
  targetSourceStatus: number | null;
  onLogin: () => void;
  onInjectedLogin: () => void;
  hasInjected: boolean;
  onSwitch: () => void;
  onDisconnect: () => void;
  onPropose: () => void;
  onCancel: () => void;
  onClaim: () => void;
};

const CARD =
  "rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]";
const VALUE = "mt-2 text-xs tracking-[0.08em] text-[var(--ink)]";

function statusLabel(s: number | null) {
  if (s === null) return "-";
  if (s === ProposalStatus.Pending) return "Pending";
  if (s === ProposalStatus.Claimed) return "Claimed";
  return "None";
}

function BaseBoundUI(p: UIProps) {
  const isSource = p.mode === "source";

  const sourceAtCapacity = p.activeCount !== null && p.activeCount >= 3;
  const canPropose =
    Boolean(p.account) &&
    Boolean(p.normalizedTarget) &&
    p.chainReady &&
    !p.busy &&
    p.sourceTargetStatus !== ProposalStatus.Pending &&
    p.sourceTargetStatus !== ProposalStatus.Claimed &&
    !sourceAtCapacity;
  const canCancel =
    Boolean(p.account) &&
    Boolean(p.normalizedTarget) &&
    p.chainReady &&
    !p.busy &&
    p.sourceTargetStatus === ProposalStatus.Pending;

  const targetFull = p.targetBalance !== null && p.targetBalance >= 1;
  const canClaim =
    Boolean(p.account) &&
    Boolean(p.normalizedSource) &&
    p.chainReady &&
    !p.busy &&
    !targetFull &&
    p.targetSourceStatus === ProposalStatus.Pending;

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--surface)] px-4 md:px-8"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.75rem))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(27,67,255,0.16),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(117,206,255,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.84),rgba(244,248,255,0.94))]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-md flex-col justify-center gap-4">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] shadow-[0_30px_100px_rgba(34,74,255,0.08)] backdrop-blur-xl">
          <div className="aspect-[768/590] w-full">
            <StaticCover alt="BaseBoundID animated cover" />
          </div>
        </section>

        <section className="relative z-50 w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_30px_100px_rgba(34,74,255,0.08)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] border border-[var(--line)] bg-[#f5f8ff] p-1">
              <button
                type="button"
                onClick={() => p.setMode("source")}
                className={`h-11 rounded-[1rem] text-xs font-semibold tracking-[0.08em] uppercase ${
                  isSource
                    ? "bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] text-white"
                    : "text-[var(--ink)]"
                }`}
              >
                I&apos;m the Source
              </button>
              <button
                type="button"
                onClick={() => p.setMode("target")}
                className={`h-11 rounded-[1rem] text-xs font-semibold tracking-[0.08em] uppercase ${
                  !isSource
                    ? "bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] text-white"
                    : "text-[var(--ink)]"
                }`}
              >
                I&apos;m the Target
              </button>
            </div>

            <p className="px-1 text-center text-[11px] leading-5 text-[var(--muted)]">
              {isSource
                ? "Propose a wallet to link to your Base account. They claim it to complete the link."
                : "Claim the BaseBoundID a source proposed to you. You also receive an onchain attestation."}
            </p>

            {/* Auth */}
            {p.isConnected ? (
              <button
                type="button"
                onClick={p.onDisconnect}
                className="h-14 w-full touch-manipulation rounded-[1.2rem] border border-[var(--line)] bg-white px-4 text-sm font-semibold tracking-[0.02em] text-[var(--ink)]"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Disconnect
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={p.onLogin}
                  disabled={!p.hydrated || p.isSigningIn}
                  className="h-14 w-full touch-manipulation rounded-[1.2rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {p.isSigningIn ? "Signing in..." : "Sign in with Base"}
                </button>
                <button
                  type="button"
                  onClick={p.onInjectedLogin}
                  disabled={!p.hydrated || p.isSigningIn || !p.hasInjected}
                  className="h-12 w-full touch-manipulation rounded-[1.1rem] border border-[var(--line)] bg-white px-4 text-sm font-semibold tracking-[0.02em] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {p.hasInjected
                    ? "Connect browser wallet (Rabby / MetaMask)"
                    : "No browser wallet detected"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className={CARD}>
                Connected
                <div className={VALUE}>
                  {p.account
                    ? shortenAddress(p.account)
                    : p.isConnecting
                      ? "Connecting"
                      : "Not connected"}
                </div>
              </div>
              <div className={CARD}>
                Network
                <div className={VALUE}>
                  {p.walletChainId === null
                    ? "Unknown"
                    : p.chainReady
                      ? "Base Sepolia"
                      : `Chain ${p.walletChainId}`}
                </div>
              </div>
            </div>

            {isSource ? (
              <div className="grid grid-cols-2 gap-3">
                <div className={CARD}>
                  Slots Used
                  <div className={VALUE}>
                    {p.activeCount === null ? "-" : `${p.activeCount} / 3`}
                  </div>
                </div>
                <div className={CARD}>
                  This Pair
                  <div className={VALUE}>{statusLabel(p.sourceTargetStatus)}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className={CARD}>
                  You Hold
                  <div className={VALUE}>
                    {p.targetBalance === null ? "-" : `${p.targetBalance} / 1`}
                  </div>
                </div>
                <div className={CARD}>
                  This Pair
                  <div className={VALUE}>{statusLabel(p.targetSourceStatus)}</div>
                </div>
              </div>
            )}

            {/* Address input */}
            <label className="flex flex-col gap-2 rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
                {isSource ? "Target wallet" : "Source (who proposed you)"}
              </span>
              <input
                value={isSource ? p.targetInput : p.sourceInput}
                onChange={(e) =>
                  isSource
                    ? p.setTargetInput(e.target.value)
                    : p.setSourceInput(e.target.value)
                }
                placeholder="0x..."
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-12 rounded-[1rem] border border-[var(--line)] bg-white px-4 text-sm text-[var(--ink)] outline-none"
              />
              {isSource ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => p.setTargetInput(p.account ?? "")}
                    disabled={!p.account}
                    className="h-10 flex-1 rounded-[1rem] border border-[var(--line)] bg-[#f5f8ff] px-3 text-xs font-semibold tracking-[0.04em] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Use connected
                  </button>
                  <button
                    type="button"
                    onClick={() => p.setTargetInput("")}
                    className="h-10 flex-1 rounded-[1rem] border border-[var(--line)] bg-[#f5f8ff] px-3 text-xs font-semibold tracking-[0.04em] text-[var(--ink)]"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </label>

            {!p.chainReady && p.account ? (
              <button
                type="button"
                onClick={p.onSwitch}
                disabled={p.isSwitching}
                className="h-12 w-full rounded-[1.1rem] border border-[var(--line)] bg-white px-4 text-sm font-semibold tracking-[0.02em] text-[var(--ink)]"
              >
                {p.isSwitching ? "Switching..." : "Switch to Base Sepolia"}
              </button>
            ) : null}

            {/* Primary actions */}
            {isSource ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={p.onPropose}
                  disabled={!canPropose}
                  className="h-14 w-full touch-manipulation rounded-[1.2rem] bg-[linear-gradient(135deg,#0f1733,#2953ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {p.busy ? "Working..." : "Propose Link"}
                </button>
                {p.sourceTargetStatus === ProposalStatus.Pending ? (
                  <button
                    type="button"
                    onClick={p.onCancel}
                    disabled={!canCancel}
                    className="h-12 w-full rounded-[1.1rem] border border-[var(--line)] bg-white px-4 text-sm font-semibold tracking-[0.02em] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel Proposal
                  </button>
                ) : null}
                {sourceAtCapacity ? (
                  <p className="text-center text-[11px] text-[#8f3131]">
                    All 3 slots are in use. Cancel a pending one to free a slot.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={p.onClaim}
                  disabled={!canClaim}
                  className="h-14 w-full touch-manipulation rounded-[1.2rem] bg-[linear-gradient(135deg,#0f1733,#2953ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {p.busy ? "Working..." : "Claim + Attest"}
                </button>
                {targetFull ? (
                  <p className="text-center text-[11px] text-[#8f3131]">
                    This wallet already holds a BaseBoundID (max 1).
                  </p>
                ) : p.targetSourceStatus !== null &&
                  p.targetSourceStatus !== ProposalStatus.Pending &&
                  p.normalizedSource ? (
                  <p className="text-center text-[11px] text-[var(--muted)]">
                    No pending proposal from this source.
                  </p>
                ) : null}
              </div>
            )}

            <div className={CARD}>
              Status
              <div className="mt-2 break-words normal-case text-xs tracking-[0.02em] text-[var(--ink)]">
                {p.status}
              </div>
            </div>

            {p.errorMsg ? (
              <div className="rounded-[1.2rem] border border-[rgba(176,58,58,0.16)] bg-[rgba(255,245,245,0.92)] p-4 text-center text-[11px] font-medium normal-case tracking-[0.02em] text-[#8f3131]">
                {p.errorMsg}
              </div>
            ) : null}

            {p.lastTx ? (
              <a
                href={`https://sepolia.basescan.org/tx/${p.lastTx}`}
                target="_blank"
                rel="noreferrer"
                className={CARD}
              >
                Last Tx
                <div className={VALUE}>{shortenAddress(p.lastTx)}</div>
              </a>
            ) : null}
          </div>

          <div className="mt-5 border-t border-[var(--line)] px-1 pt-3 text-center text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
            BaseBoundID v0.2.0
          </div>
        </section>
      </div>
    </main>
  );
}
