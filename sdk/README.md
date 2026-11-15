# TrustMint TypeScript SDK

The TrustMint SDK contains typed clients for calling the repository's Soroban examples from a TypeScript application. It currently covers the KYC registry, compliance engine, invoice token, property token, carbon-credit token, and RWA reference token.

> **Status:** The SDK is under active development and has not been published to npm. It is included in this repository for evaluation and local integration.

## Build from this repository

The SDK is an npm workspace. From the repository root:

```bash
npm install
npm run build:sdk
```

The generated JavaScript and type declarations are written to `sdk/dist/` when built. The SDK expects the application to provide the Stellar SDK as a peer dependency.

## Create a client

Create a Soroban RPC server using a preset (`"testnet"`, `"mainnet"`, or `"local"`) or an explicit custom RPC configuration, then pass the contract ID, server, and matching network passphrase to a contract client:

```ts
import {
  InvoiceTokenClient,
  NETWORK_PASSPHRASES,
  createServer,
  resolveNetworkConfig,
} from "@trustmint/sdk";

// 1. Default Testnet RPC endpoint
const network = "testnet";
const server = createServer(network);
const invoice = new InvoiceTokenClient(
  process.env.INVOICE_TOKEN_ID!,
  server,
  NETWORK_PASSPHRASES[network],
);

// 2. Custom Soroban RPC provider or local Quickstart node
const customConfig = resolveNetworkConfig({
  network: "local",
  rpcUrl: "http://localhost:8000/soroban/rpc",
});
const localServer = createServer(customConfig);
const localInvoice = new InvoiceTokenClient(
  process.env.LOCAL_INVOICE_TOKEN_ID!,
  localServer,
  customConfig.networkPassphrase,
);

const supply = await invoice.totalSupply();
console.log(supply);
```

`resolveNetworkConfig` and `createServer` validate that:
- Any explicit `networkPassphrase` matches the declared `network` preset (`testnet`, `mainnet`, or `local`).
- A testnet RPC hostname is not paired with `network: "mainnet"` (and vice versa).
- Plain `http:` endpoints are rejected for `testnet` and `mainnet` unless `allowHttp: true` is explicitly provided (loopback `http://localhost:8000/soroban/rpc` is enabled automatically for `network: "local"`).

Use contract IDs deployed to the same network as the RPC server. Do not place private keys or identity data in frontend environment variables. Transaction operations built by the SDK still need to be assembled into a transaction, signed by the appropriate account, and submitted using a wallet or signer you control.

## Available clients

| Client | Example operations |
| --- | --- |
| `KycRegistryClient` | Read holder approval and KYC records; build verifier operations. |
| `ComplianceEngineClient` | Read transfer policy and build admin policy operations. |
| `InvoiceTokenClient` | Read token and invoice state; build issue, settle, redeem, transfer, and approval operations. |
| `PropertyTokenClient` | Read property metadata and share state; build property operations. |
| `CarbonTokenClient` | Read project and credit state; build issue, retire, and transfer operations. |
| `RwaTokenClient` | Read reference token metadata and balances; build token operations. |

Contract interfaces can change while the project is in early development. Check each client implementation and the matching contract before relying on a method. See the root [README](../README.md) for project status, setup, and security limitations.