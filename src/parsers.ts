import { Buffer } from "buffer";

import {
	PublicKey,
	TransactionInstruction,
	SystemInstruction,
	SystemProgram,
	Connection,
	Message,
	Transaction,
	AccountMeta,
	ParsedMessage,
	ParsedInstruction as SolanaParsedInstruction,
	PartiallyDecodedInstruction,
	Finality,
	VersionedMessage,
	LoadedAddresses,
	VersionedTransactionResponse,
	ParsedTransactionWithMeta,
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { BN, BorshInstructionCoder, Idl, SystemProgram as SystemProgramIdl } from "@coral-xyz/anchor";
import { blob, struct, u8 } from "@solana/buffer-layout";

import { SplToken } from "./programs/spl-token.program";
import {
	AssociatedTokenProgramIdlLike,
	IdlAccount,
	IdlAccountItem,
	IdlAccounts,
	InstructionNames,
	InstructionParserInfo,
	InstructionParsers,
	ParsedIdlArgs,
	ParsedIdlInstruction,
	ParsedInstruction,
	ParserFunction,
	ProgramInfoType,
	UnknownInstruction,
} from "./interfaces";
import {
	compiledInstructionToInstruction,
	flattenParsedTransaction,
	flattenTransactionResponse,
	parsedInstructionToInstruction,
	parseTransactionAccounts,
} from "./helpers";

const MEMO_PROGRAM_V1 = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";
const MEMO_PROGRAM_V2 = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

function decodeSystemInstruction(instruction: TransactionInstruction): ParsedInstruction<SystemProgramIdl> {
	const ixType = SystemInstruction.decodeInstructionType(instruction);
	let parsed: ParsedIdlInstruction<SystemProgramIdl> | null;
	switch (ixType) {
		case "AdvanceNonceAccount": {
			const decoded = SystemInstruction.decodeNonceAdvance(instruction);
			parsed = {
				name: "advanceNonceAccount",
				accounts: [
					{ name: "nonce", pubkey: decoded.noncePubkey, isSigner: false, isWritable: true },
					{ name: "recentBlockhashSysvar", ...instruction.keys[1] },
					{ name: "nonceAuthority", pubkey: decoded.authorizedPubkey, isSigner: true, isWritable: false },
				],
				args: {},
			} as ParsedIdlInstruction<SystemProgramIdl, "advanceNonceAccount">;
			break;
		}
		case "Allocate": {
			const decoded = SystemInstruction.decodeAllocate(instruction);
			parsed = {
				name: "allocate",
				accounts: [{ name: "newAccount", pubkey: decoded.accountPubkey, isSigner: true, isWritable: true }],
				args: { space: new BN(decoded.space) },
			} as ParsedIdlInstruction<SystemProgramIdl, "allocate">;
			break;
		}
		case "AllocateWithSeed": {
			const decoded = SystemInstruction.decodeAllocateWithSeed(instruction);
			parsed = {
				name: "allocateWithSeed",
				accounts: [
					{ name: "newAccount", pubkey: decoded.accountPubkey, isSigner: false, isWritable: true },
					{ name: "base", pubkey: decoded.basePubkey, isSigner: true, isWritable: false },
				],
				args: {
					seed: decoded.seed,
					space: new BN(decoded.space),
					owner: decoded.programId,
					base: decoded.basePubkey,
				},
			} as ParsedIdlInstruction<SystemProgramIdl, "allocateWithSeed">;
			break;
		}
		case "Assign": {
			const decoded = SystemInstruction.decodeAssign(instruction);
			parsed = {
				name: "assign",
				accounts: [{ name: "assignedAccount", pubkey: decoded.accountPubkey, isSigner: true, isWritable: true }],
				args: { owner: decoded.programId },
			} as ParsedIdlInstruction<SystemProgramIdl, "assign">;
			break;
		}
		case "AssignWithSeed": {
			const decoded = SystemInstruction.decodeAssignWithSeed(instruction);
			parsed = {
				name: "assignWithSeed",
				accounts: [
					{ name: "assigned", pubkey: decoded.accountPubkey, isSigner: false, isWritable: true },
					{ name: "base", pubkey: decoded.basePubkey, isSigner: true, isWritable: false },
				],
				args: {
					seed: decoded.seed, // string
					owner: decoded.programId,
					base: decoded.basePubkey,
				},
			} as ParsedIdlInstruction<SystemProgramIdl, "assignWithSeed">;
			break;
		}
		case "AuthorizeNonceAccount": {
			const decoded = SystemInstruction.decodeNonceAuthorize(instruction);
			parsed = {
				name: "authorizeNonceAccount",
				accounts: [
					{ name: "nonce", isSigner: false, isWritable: true, pubkey: decoded.noncePubkey },
					{ name: "nonceAuthority", isSigner: true, isWritable: false, pubkey: decoded.authorizedPubkey },
				],
				args: { authorized: decoded.newAuthorizedPubkey },
			} as ParsedIdlInstruction<SystemProgramIdl, "authorizeNonceAccount">;
			break;
		}
		case "Create": {
			const decoded = SystemInstruction.decodeCreateAccount(instruction);
			parsed = {
				name: "createAccount",
				accounts: [
					{ name: "payer", pubkey: decoded.fromPubkey, isSigner: true, isWritable: true },
					{ name: "newAccount", pubkey: decoded.newAccountPubkey, isSigner: true, isWritable: true },
				],
				args: { lamports: new BN(decoded.lamports), owner: decoded.programId, space: new BN(decoded.space) },
			} as ParsedIdlInstruction<SystemProgramIdl, "createAccount">;
			break;
		}
		case "CreateWithSeed": {
			const decoded = SystemInstruction.decodeCreateWithSeed(instruction);
			parsed = {
				name: "createAccountWithSeed",
				accounts: [
					{ name: "payer", pubkey: decoded.fromPubkey, isSigner: true, isWritable: true },
					{ name: "created", pubkey: decoded.newAccountPubkey, isSigner: false, isWritable: true },
					{ name: "base", pubkey: decoded.basePubkey, isSigner: true, isWritable: false },
				],
				args: {
					lamports: new BN(decoded.lamports),
					owner: decoded.programId,
					space: new BN(decoded.space),
					seed: decoded.seed,
					base: decoded.basePubkey,
				},
			} as ParsedIdlInstruction<SystemProgramIdl, "createAccountWithSeed">;
			break;
		}
		case "InitializeNonceAccount": {
			const decoded = SystemInstruction.decodeNonceInitialize(instruction);
			parsed = {
				name: "initializeNonceAccount",
				accounts: [
					{ name: "nonce", pubkey: decoded.noncePubkey, isSigner: false, isWritable: true },
					{ name: "recentBlockhashSysvar", ...instruction.keys[1] },
					{ name: "rentSysvar", ...instruction.keys[2] },
				],
				args: { authorized: decoded.authorizedPubkey },
			} as ParsedIdlInstruction<SystemProgramIdl, "initializeNonceAccount">;
			break;
		}
		case "Transfer": {
			const decoded = SystemInstruction.decodeTransfer(instruction);
			parsed = {
				name: "transfer",
				accounts: [
					{ name: "sender", pubkey: decoded.fromPubkey, isSigner: true, isWritable: true },
					{ name: "receiver", pubkey: decoded.toPubkey, isWritable: true, isSigner: false },
				],
				args: { lamports: new BN(decoded.lamports.toString()) },
			} as ParsedIdlInstruction<SystemProgramIdl, "transfer">;
			break;
		}
		case "TransferWithSeed": {
			const decoded = SystemInstruction.decodeTransferWithSeed(instruction);
			parsed = {
				name: "transferWithSeed",
				accounts: [
					{ name: "sender", pubkey: decoded.fromPubkey, isSigner: false, isWritable: true },
					{ name: "base", pubkey: decoded.basePubkey, isSigner: true, isWritable: false },
					{ name: "receiver", pubkey: decoded.toPubkey, isSigner: false, isWritable: true },
				],
				args: { owner: decoded.programId, lamports: new BN(decoded.lamports.toString()), seed: decoded.seed },
			} as ParsedIdlInstruction<SystemProgramIdl, "transferWithSeed">;
			break;
		}
		case "WithdrawNonceAccount": {
			const decoded = SystemInstruction.decodeNonceWithdraw(instruction);
			parsed = {
				name: "withdrawNonceAccount",
				accounts: [
					{ name: "nonce", pubkey: decoded.noncePubkey, isSigner: false, isWritable: true },
					{ name: "recepient", pubkey: decoded.toPubkey, isSigner: false, isWritable: true },
					{ name: "recentBlockhashSysvar", ...instruction.keys[2] },
					{ name: "rentSysvar", ...instruction.keys[3] },
					{ name: "nonceAuthority", pubkey: decoded.noncePubkey, isSigner: true, isWritable: false },
				],
				args: { lamports: new BN(decoded.lamports) },
			} as ParsedIdlInstruction<SystemProgramIdl, "withdrawNonceAccount">;
			break;
		}
		default: {
			parsed = null;
		}
	}

	return parsed
		? {
				...parsed,
				programId: SystemProgram.programId,
		  }
		: {
				programId: SystemProgram.programId,
				name: "unknown",
				accounts: instruction.keys,
				args: { unknown: instruction.data },
		  };
}

function decodeTokenInstruction(instruction: TransactionInstruction): ParsedInstruction<SplToken> {
	let parsed: ParsedIdlInstruction<SplToken> | null;
	const decoded = u8().decode(instruction.data);
	switch (decoded) {
		case spl.TokenInstruction.InitializeMint: {
			const decodedIx = spl.decodeInitializeMintInstruction(instruction);
			parsed = {
				name: "initializeMint",
				accounts: [
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "rentSysvar", ...decodedIx.keys.rent },
				],
				args: { decimals: decodedIx.data.decimals, mintAuthority: decodedIx.data.mintAuthority, freezeAuthority: decodedIx.data.freezeAuthority },
			} as ParsedIdlInstruction<SplToken, "initializeMint">;
			break;
		}
		case spl.TokenInstruction.InitializeAccount: {
			const decodedIx = spl.decodeInitializeAccountInstruction(instruction);
			parsed = {
				name: "initializeAccount",
				accounts: [
					{ name: "newAccount", ...decodedIx.keys.account },
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "owner", ...decodedIx.keys.owner },
					{ name: "rentSysvar", ...decodedIx.keys.rent },
				],
				args: {},
			} as ParsedIdlInstruction<SplToken, "initializeAccount">;
			break;
		}
		case spl.TokenInstruction.InitializeMultisig: {
			const decodedIx = spl.decodeInitializeMultisigInstruction(instruction);
			const multisig = decodedIx.keys.signers.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "initializeMultisig",
				accounts: [{ name: "multisig", ...decodedIx.keys.account }, { name: "rentSysvar", ...decodedIx.keys.rent }, ...multisig],
				args: { m: decodedIx.data.m },
			} as ParsedIdlInstruction<SplToken, "initializeMultisig">;
			break;
		}
		case spl.TokenInstruction.Transfer: {
			const decodedIx = spl.decodeTransferInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "transfer",
				accounts: [
					{ name: "source", ...decodedIx.keys.source },
					{ name: "destination", ...decodedIx.keys.destination },
					{ name: "owner", ...decodedIx.keys.owner },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()) },
			} as ParsedIdlInstruction<SplToken, "transfer">;
			break;
		}
		case spl.TokenInstruction.Approve: {
			const decodedIx = spl.decodeApproveInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "approve",
				accounts: [
					{ name: "source", ...decodedIx.keys.account },
					{ name: "delegate", ...decodedIx.keys.delegate },
					{ name: "owner", ...decodedIx.keys.owner },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()) },
			} as ParsedIdlInstruction<SplToken, "approve">;
			break;
		}
		case spl.TokenInstruction.Revoke: {
			const decodedIx = spl.decodeRevokeInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "revoke",
				accounts: [{ name: "source", ...decodedIx.keys.account }, { name: "owner", ...decodedIx.keys.owner }, ...multisig],
				args: {},
			} as ParsedIdlInstruction<SplToken, "revoke">;
			break;
		}
		case spl.TokenInstruction.SetAuthority: {
			const decodedIx = spl.decodeSetAuthorityInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "setAuthority",
				accounts: [{ name: "account", ...decodedIx.keys.account }, { name: "currentAuthority", ...decodedIx.keys.currentAuthority }, ...multisig],
				args: { authorityType: decodedIx.data.authorityType, newAuthority: decodedIx.data.newAuthority },
			} as ParsedIdlInstruction<SplToken, "setAuthority">;
			break;
		}
		case spl.TokenInstruction.MintTo: {
			const decodedIx = spl.decodeMintToInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "mintTo",
				accounts: [
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "mintTo", ...decodedIx.keys.destination },
					{ name: "authority", ...decodedIx.keys.authority },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()) },
			} as ParsedIdlInstruction<SplToken, "mintTo">;
			break;
		}
		case spl.TokenInstruction.Burn: {
			const decodedIx = spl.decodeBurnInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "burn",
				accounts: [
					{ name: "burnFrom", ...decodedIx.keys.account },
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "owner", ...decodedIx.keys.owner },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()) },
			} as ParsedIdlInstruction<SplToken, "burn">;
			break;
		}
		case spl.TokenInstruction.CloseAccount: {
			const decodedIx = spl.decodeCloseAccountInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "closeAccount",
				accounts: [
					{ name: "account", ...decodedIx.keys.account },
					{ name: "destination", ...decodedIx.keys.destination },
					{ name: "owner", ...decodedIx.keys.authority },
					...multisig,
				],
				args: {},
			} as ParsedIdlInstruction<SplToken, "closeAccount">;
			break;
		}
		case spl.TokenInstruction.FreezeAccount: {
			const decodedIx = spl.decodeFreezeAccountInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "freezeAccount",
				accounts: [
					{ name: "account", ...decodedIx.keys.account },
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "authority", ...decodedIx.keys.authority },
					...multisig,
				],
				args: {},
			} as ParsedIdlInstruction<SplToken, "freezeAccount">;
			break;
		}
		case spl.TokenInstruction.ThawAccount: {
			const decodedIx = spl.decodeThawAccountInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "thawAccount",
				accounts: [
					{ name: "account", ...decodedIx.keys.account },
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "authority", ...decodedIx.keys.authority },
					...multisig,
				],
				args: {},
			} as ParsedIdlInstruction<SplToken, "thawAccount">;
			break;
		}
		case spl.TokenInstruction.TransferChecked: {
			const decodedIx = spl.decodeTransferCheckedInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "transferChecked",
				accounts: [
					{ name: "source", ...decodedIx.keys.source },
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "destination", ...decodedIx.keys.destination },
					{ name: "owner", ...decodedIx.keys.owner },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()), decimals: decodedIx.data.decimals },
			} as ParsedIdlInstruction<SplToken, "transferChecked">;
			break;
		}
		case spl.TokenInstruction.ApproveChecked: {
			const decodedIx = spl.decodeApproveCheckedInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "approveChecked",
				accounts: [
					{ name: "source", ...decodedIx.keys.account },
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "delegate", ...decodedIx.keys.delegate },
					{ name: "owner", ...decodedIx.keys.owner },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()), decimals: decodedIx.data.decimals },
			} as ParsedIdlInstruction<SplToken, "approveChecked">;
			break;
		}
		case spl.TokenInstruction.MintToChecked: {
			const decodedIx = spl.decodeMintToCheckedInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "mintToChecked",
				accounts: [
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "mintTo", ...decodedIx.keys.destination },
					{ name: "authority", ...decodedIx.keys.authority },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()), decimals: decodedIx.data.decimals },
			} as ParsedIdlInstruction<SplToken, "mintToChecked">;
			break;
		}
		case spl.TokenInstruction.BurnChecked: {
			const decodedIx = spl.decodeBurnCheckedInstruction(instruction);
			const multisig = decodedIx.keys.multiSigners.map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "burnChecked",
				accounts: [
					{ name: "burnFrom", ...decodedIx.keys.account },
					{ name: "tokenMint", ...decodedIx.keys.mint },
					{ name: "owner", ...decodedIx.keys.owner },
					...multisig,
				],
				args: { amount: new BN(decodedIx.data.amount.toString()), decimals: decodedIx.data.decimals },
			} as ParsedIdlInstruction<SplToken, "burnChecked">;
			break;
		}
		case spl.TokenInstruction.InitializeAccount2: {
			interface InitializeAccount2InstructionData {
				instruction: spl.TokenInstruction.InitializeAccount2;
				owner: Uint8Array;
			}

			const initializeAccount2InstructionData = struct<InitializeAccount2InstructionData>([u8("instruction"), blob(32, "owner")]);

			const decodedIx = initializeAccount2InstructionData.decode(instruction.data);
			parsed = {
				name: "initializeAccount2",
				accounts: [
					{ name: "newAccount", ...instruction.keys[0] },
					{ name: "tokenMint", ...instruction.keys[1] },
					{ name: "rentSysvar", ...instruction.keys[2] },
				],
				args: { authority: new PublicKey(decodedIx.owner) },
			} as ParsedIdlInstruction<SplToken, "initializeAccount2">;
			break;
		}
		case spl.TokenInstruction.SyncNative: {
			parsed = {
				name: "syncNative",
				accounts: [{ name: "account", ...instruction.keys[0] }],
				args: {},
			} as ParsedIdlInstruction<SplToken, "syncNative">;
			break;
		}
		case spl.TokenInstruction.InitializeAccount3: {
			interface InitializeAccount3InstructionData {
				instruction: spl.TokenInstruction.InitializeAccount3;
				owner: Uint8Array;
			}

			const initializeAccount3InstructionData = struct<InitializeAccount3InstructionData>([u8("instruction"), blob(32, "owner")]);

			const decodedIx = initializeAccount3InstructionData.decode(instruction.data);
			parsed = {
				name: "initializeAccount3",
				accounts: [
					{ name: "newAccount", ...instruction.keys[0] },
					{ name: "tokenMint", ...instruction.keys[1] },
				],
				args: { authority: new PublicKey(decodedIx.owner) },
			} as ParsedIdlInstruction<SplToken, "initializeAccount3">;
			break;
		}
		case spl.TokenInstruction.InitializeMultisig2: {
			const multisig = instruction.keys.slice(1).map((meta, idx) => ({ name: `signer_${idx}`, ...meta }));
			parsed = {
				name: "initializeMultisig2",
				accounts: [{ name: "multisig", ...instruction.keys[0] }, ...multisig],
				args: { m: instruction.data[1] },
			} as ParsedIdlInstruction<SplToken, "initializeMultisig2">;
			break;
		}
		case spl.TokenInstruction.InitializeMint2: {
			const decodedIx = spl.decodeInitializeMintInstructionUnchecked(instruction);
			const tokenMint = decodedIx.keys.mint;
			if (!tokenMint) throw new Error(`Failed to parse InitializeMint2 instruction`);
			parsed = {
				name: "initializeMint2",
				accounts: [{ name: "tokenMint", ...decodedIx.keys.mint }],
				args: { decimals: decodedIx.data.decimals, mintAuthority: decodedIx.data.mintAuthority, freezeAuthority: decodedIx.data.freezeAuthority },
			} as ParsedIdlInstruction<SplToken, "initializeMint2">;
			break;
		}
		default: {
			parsed = null;
		}
	}

	return parsed
		? {
				...parsed,
				programId: spl.TOKEN_PROGRAM_ID,
		  }
		: {
				programId: spl.TOKEN_PROGRAM_ID,
				name: "unknown",
				accounts: instruction.keys,
				args: { unknown: instruction.data },
		  };
}

function decodeAssociatedTokenInstruction(instruction: TransactionInstruction): ParsedInstruction<AssociatedTokenProgramIdlLike> {
	return {
		name: "createAssociatedTokenAccount",
		accounts: [
			{ name: "fundingAccount", ...instruction.keys[0] },
			{ name: "newAccount", ...instruction.keys[1] },
			{ name: "wallet", ...instruction.keys[2] },
			{ name: "tokenMint", ...instruction.keys[3] },
			{ name: "systemProgram", ...instruction.keys[4] },
			{ name: "tokenProgram", ...instruction.keys[5] },
			...[instruction.keys.length > 5 ? { name: "rentSysvar", ...instruction.keys[6] } : undefined],
		],
		args: {},
		programId: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
	} as ParsedInstruction<AssociatedTokenProgramIdlLike, "createAssociatedTokenAccount">;
}

function flattenIdlAccounts(accounts: IdlAccountItem[], prefix?: string): IdlAccount[] {
	return accounts
		.map((account) => {
			const accName = account.name;
			if (Object.prototype.hasOwnProperty.call(account, "accounts")) {
				const newPrefix = prefix ? `${prefix} > ${accName}` : accName;

				return flattenIdlAccounts((<IdlAccounts>account).accounts, newPrefix);
			} else {
				return {
					...(<IdlAccount>account),
					name: prefix ? `${prefix} > ${accName}` : accName,
				};
			}
		})
		.flat();
}

/**
 * Class for parsing arbitrary solana transactions in various formats
 * - by txHash
 * - from raw transaction data (base64 encoded or buffer)
 * - @solana/web3.js getTransaction().message object
 * - @solana/web3.js getParsedTransaction().message or Transaction.compileMessage() object
 * - @solana/web3.js TransactionInstruction object
 */
export class SolanaParser {
	private instructionParsers: InstructionParsers;
	private instructionDecoders: Map<string, BorshInstructionCoder>;
	/**
	 * Initializes parser object
	 * `SystemProgram`, `TokenProgram` and `AssociatedTokenProgram` are supported by default
	 * but may be overriden by providing custom idl/custom parser
	 * @param programInfos list of objects which contains programId and corresponding idl
	 * @param parsers list of pairs (programId, custom parser)
	 */
	constructor(programInfos: ProgramInfoType[], parsers?: InstructionParserInfo[]) {
		this.instructionDecoders = new Map();
		this.instructionParsers = new Map();
		const standardParsers: InstructionParserInfo[] = [
			[SystemProgram.programId.toBase58(), decodeSystemInstruction],
			[spl.TOKEN_PROGRAM_ID.toBase58(), decodeTokenInstruction],
			[spl.ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), decodeAssociatedTokenInstruction],
		];
		for (const programInfo of programInfos) {
			this.addParserFromIdl(programInfo.programId.toString(), programInfo.idl);
		}

		let result: InstructionParsers;
		if (!parsers) {
			result = new Map(standardParsers);
		} else {
			// first set provided parsers
			result = new Map(parsers);
			// append standart parsers if parser not exist yet
			for (const parserInfo of standardParsers) {
				if (!result.has(parserInfo[0])) {
					result.set(...parserInfo);
				}
			}
		}

		result.forEach((parser, key) => this.instructionParsers.set(key, parser))
	}

	/**
	 * Adds (or updates) parser for provided programId
	 * @param programId program id to add parser for
	 * @param parser parser to parse programId instructions
	 */
	addParser(programId: PublicKey, parser: ParserFunction<Idl, string>) {
		this.instructionParsers.set(programId.toBase58(), parser);
	}

	/**
	 * Adds (or updates) parser for provided programId
	 * @param programId program id to add parser for
	 * @param idl IDL that describes anchor program
	 */
	addParserFromIdl(programId: string, idl: Idl) {
		this.instructionDecoders.set(programId, new BorshInstructionCoder(idl));
		const [key, parser] = this.buildIdlParser(programId, idl)
		this.instructionParsers.set(key, parser);
	}

	private buildIdlParser(programId: string, idl: Idl): InstructionParserInfo {
		const idlParser: ParserFunction<typeof idl, InstructionNames<typeof idl>> = (instruction: TransactionInstruction, decoder: BorshInstructionCoder) => {
			const parsedIx = decoder?.decode(instruction.data);
			if (!parsedIx) {
				return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data);
			} else {
				const ix = idl.instructions.find((instr) => instr.name === parsedIx.name);
				if (!ix) {
					return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data, parsedIx.name);
				}
				const flatIdlAccounts = flattenIdlAccounts(<IdlAccountItem[]>ix.accounts);
				const accounts = instruction.keys.map((meta, idx) => {
					if (idx < flatIdlAccounts.length) {
						return {
							name: flatIdlAccounts[idx].name,
							...meta,
						};
					}
					// "Remaining accounts" are unnamed in Anchor.
					else {
						return {
							name: `Remaining ${idx - flatIdlAccounts.length}`,
							...meta,
						};
					}
				});
				return {
					name: parsedIx.name,
					accounts,
					programId: instruction.programId,
					args: parsedIx.data as ParsedIdlArgs<typeof idl, (typeof idl)["instructions"][number]["name"]>, // as IxArgsMap<typeof idl, typeof idl["instructions"][number]["name"]>,
				};
			}
		};
		return [programId, idlParser.bind(this)];
	}

	/**
	 * Removes parser for provided program id
	 * @param programId program id to remove parser for
	 */
	removeParser(programId: PublicKey) {
		this.instructionParsers.delete(programId.toBase58());
	}

	private buildUnknownParsedInstruction(programId: PublicKey, accounts: AccountMeta[], argData: unknown, name?: string): UnknownInstruction {
		return {
			programId,
			accounts,
			args: { unknown: argData },
			name: name || "unknown",
		};
	}

	/**
	 * Parses instruction
	 * @param instruction transaction instruction to parse
	 * @returns parsed transaction instruction or UnknownInstruction
	 */
	parseInstruction<I extends Idl, IxName extends InstructionNames<I>>(instruction: TransactionInstruction): ParsedInstruction<I, IxName> {
		if (!this.instructionParsers.has(instruction.programId.toBase58())) {
			return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data);
		} else {
			try {
				const parser = this.instructionParsers.get(instruction.programId.toBase58()) as ParserFunction<I, IxName>;
				const decoder = this.instructionDecoders.get(instruction.programId.toBase58()) as BorshInstructionCoder;

				return parser(instruction, decoder);
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error("Parser does not matching the instruction args", {
					programId: instruction.programId.toBase58(),
					instructionData: instruction.data.toString("hex"),
				});

				return this.buildUnknownParsedInstruction(instruction.programId, instruction.keys, instruction.data);
			}
		}
	}

	/**
	 * Parses transaction data along with inner instructions
	 * @param tx response to parse
	 * @returns list of parsed instructions
	 */
	parseTransactionWithInnerInstructions<T extends VersionedTransactionResponse>(tx: T): ParsedInstruction<Idl, string>[] {
		const flattened = flattenTransactionResponse(tx);

		return flattened.map(({ parentProgramId, ...ix }) => {
			const parsedIx = this.parseInstruction(ix);
			if (parentProgramId) {
				parsedIx.parentProgramId = parentProgramId;
			}

			return parsedIx;
		});
	}

	/**
	 * Parses transaction data
	 * @param txMessage message to parse
	 * @param altLoadedAddresses VersionedTransaction.meta.loaddedAddresses if tx is versioned
	 * @returns list of parsed instructions
	 */
	parseTransactionData<T extends Message | VersionedMessage>(
		txMessage: T,
		altLoadedAddresses: T extends VersionedMessage ? LoadedAddresses | undefined : undefined = undefined,
	): ParsedInstruction<Idl, string>[] {
		const parsedAccounts = parseTransactionAccounts(txMessage, altLoadedAddresses);

		return txMessage.compiledInstructions.map((instruction) => this.parseInstruction(compiledInstructionToInstruction(instruction, parsedAccounts)));
	}

	/**
	 * Parses transaction data retrieved from Connection.getParsedTransaction
	 * @param txParsedMessage message to parse
	 * @returns list of parsed instructions
	 */
	parseTransactionParsedData(txParsedMessage: ParsedMessage): ParsedInstruction<Idl, string>[] {
		const parsedAccounts = txParsedMessage.accountKeys.map((metaLike) => ({
			isSigner: metaLike.signer,
			isWritable: metaLike.writable,
			pubkey: metaLike.pubkey,
		}));

		return txParsedMessage.instructions.map((parsedIx) =>
			this.parseInstruction(parsedInstructionToInstruction(parsedIx as PartiallyDecodedInstruction, parsedAccounts)),
		);
	}

	/**
	 * Parses transaction data retrieved from Connection.getParsedTransaction along with the inner instructions
	 * @param txParsedMessage message to parse
	 * @returns list of parsed instructions
	 */
	parseParsedTransactionWithInnerInstructions(txn: ParsedTransactionWithMeta): ParsedInstruction<Idl, string>[] {
		const allInstructions = flattenParsedTransaction(txn);
		const parsedAccounts = txn.transaction.message.accountKeys.map((metaLike) => ({
			isSigner: metaLike.signer,
			isWritable: metaLike.writable,
			pubkey: metaLike.pubkey,
		}));

		return allInstructions.map(({ parentProgramId, ...instruction }) => {
			let parsedIns: ParsedInstruction<Idl, string>;
			if ("data" in instruction) {
				parsedIns = this.parseInstruction(parsedInstructionToInstruction(instruction, parsedAccounts));
			} else {
				parsedIns = this.convertSolanaParsedInstruction(instruction);
			}

			if (parentProgramId) {
				parsedIns.parentProgramId = parentProgramId;
			}

			return parsedIns;
		});
	}

	convertSolanaParsedInstruction(instruction: SolanaParsedInstruction): ParsedInstruction<Idl, string> {
		const parsed = instruction.parsed as { type: string; info: unknown };

		const pId = instruction.programId.toBase58();
		if (pId === MEMO_PROGRAM_V2 || pId === MEMO_PROGRAM_V1) {
			return {
				name: "Memo",
				programId: instruction.programId,
				args: { message: parsed },
				accounts: [],
			};
		}

		return {
			name: parsed.type,
			programId: instruction.programId,
			args: parsed.info,
			accounts: [],
		};
	}

	/**
	 * Fetches tx from blockchain and parses it
	 * @param connection web3 Connection
	 * @param txId transaction id
	 * @param flatten - true if CPI calls need to be parsed too
	 * @returns list of parsed instructions
	 */
	async parseTransaction(
		connection: Connection,
		txId: string,
		flatten: boolean = false,
		commitment: Finality = "confirmed",
	): Promise<ParsedInstruction<Idl, string>[] | null> {
		const transaction = await connection.getTransaction(txId, { commitment: commitment, maxSupportedTransactionVersion: 0 });
		if (!transaction) return null;
		if (flatten) {
			const flattened = flattenTransactionResponse(transaction);

			return flattened.map((ix) => this.parseInstruction(ix));
		}

		return this.parseTransactionData(transaction.transaction.message, transaction.meta?.loadedAddresses);
	}

	/**
	 * Parses transaction dump
	 * @param txDump base64-encoded string or raw Buffer which contains tx dump
	 * @returns list of parsed instructions
	 */
	parseTransactionDump(txDump: string | Buffer): ParsedInstruction<Idl, string>[] {
		if (!(txDump instanceof Buffer)) txDump = Buffer.from(txDump, "base64");
		const tx = Transaction.from(txDump);
		const message = tx.compileMessage();

		return this.parseTransactionData(message);
	}
}
