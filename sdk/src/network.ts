import { Networks, rpc } from "@stellar/stellar-sdk";
import type { Network, ResolvedNetworkConfig, ServerConfigOptions } from "./types.js";

export const LOCAL_NETWORK_PASSPHRASE = "Standalone Network ; February 2017";

export const RPC_URLS: Record<Network, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
  local: "http://localhost:8000/soroban/rpc",
};

export const NETWORK_PASSPHRASES: Record<Network, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
  local: LOCAL_NETWORK_PASSPHRASE,
};

const HTTP_URL_REGEX = /^(https?):\/\/([^/?#:]+)(?::(\d+))?(\/[^?#]*)?$/i;

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

/**
 * Resolves and validates a Soroban network configuration, supporting both preset
 * network names and explicit custom RPC endpoints while guarding against accidental
 * network/passphrase mismatches.
 */
export function resolveNetworkConfig(
  networkOrOptions: Network | ServerConfigOptions,
): ResolvedNetworkConfig {
  const opts: ServerConfigOptions =
    typeof networkOrOptions === "string"
      ? { network: networkOrOptions }
      : networkOrOptions;

  const expectedPassphrase = NETWORK_PASSPHRASES[opts.network];
  if (!expectedPassphrase) {
    throw new Error(`Unsupported Stellar network: "${String(opts.network)}"`);
  }

  if (
    opts.networkPassphrase !== undefined &&
    opts.networkPassphrase !== expectedPassphrase
  ) {
    throw new Error(
      `Network passphrase mismatch for "${opts.network}": expected "${expectedPassphrase}", received "${opts.networkPassphrase}".`,
    );
  }

  const rawUrl = (opts.rpcUrl ?? RPC_URLS[opts.network]).trim();
  if (!rawUrl) {
    throw new Error(`RPC URL for network "${opts.network}" must not be empty.`);
  }

  const match = HTTP_URL_REGEX.exec(rawUrl);
  if (!match) {
    throw new Error(
      `Invalid Soroban RPC URL "${rawUrl}". Expected an explicit http:// or https:// endpoint.`,
    );
  }

  const protocol = `${match[1].toLowerCase()}:`;
  const lowerHost = match[2].toLowerCase();

  if (opts.network === "mainnet" && lowerHost.includes("testnet")) {
    throw new Error(
      `Refusing to use testnet RPC endpoint "${rawUrl}" with declared network "mainnet".`,
    );
  }
  if (opts.network === "testnet" && lowerHost.includes("mainnet")) {
    throw new Error(
      `Refusing to use mainnet RPC endpoint "${rawUrl}" with declared network "testnet".`,
    );
  }

  const defaultAllowHttp =
    opts.network === "local" && isLoopbackHost(lowerHost);
  const allowHttp = opts.allowHttp ?? defaultAllowHttp;

  if (protocol === "http:" && !allowHttp) {
    throw new Error(
      `Insecure HTTP Soroban RPC endpoint "${rawUrl}" is not permitted for network "${opts.network}" unless allowHttp: true is explicitly set.`,
    );
  }

  return {
    network: opts.network,
    rpcUrl: rawUrl,
    networkPassphrase: expectedPassphrase,
    allowHttp,
  };
}

/**
 * Creates a configured Soroban `rpc.Server` for a preset network (`"testnet"`, `"mainnet"`, `"local"`)
 * or an explicit `ServerConfigOptions` object with a custom `rpcUrl`.
 */
export function createServer(
  networkOrOptions: Network | ServerConfigOptions,
): rpc.Server {
  const resolved = resolveNetworkConfig(networkOrOptions);
  return new rpc.Server(resolved.rpcUrl, { allowHttp: resolved.allowHttp });
}