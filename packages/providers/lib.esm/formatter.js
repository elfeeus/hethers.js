"use strict";
import { getAddress, getAddressFromAccount } from "@hethers/address";
import { BigNumber } from "@ethersproject/bignumber";
import { hexDataLength, hexDataSlice, hexZeroPad, isHexString } from "@ethersproject/bytes";
import { AddressZero } from "@hethers/constants";
import { accessListify, parse as parseTransaction } from "@hethers/transactions";
import { Logger } from "@hethers/logger";
import { version } from "./_version";
const logger = new Logger(version);
export class Formatter {
    constructor() {
        logger.checkNew(new.target, Formatter);
        this.formats = this.getDefaultFormats();
    }
    getDefaultFormats() {
        const formats = ({});
        const address = this.address.bind(this);
        const bigNumber = this.bigNumber.bind(this);
        const data = this.data.bind(this);
        const hash48 = this.hash48.bind(this);
        const hash32 = this.hash32.bind(this);
        const number = this.number.bind(this);
        const type = this.type.bind(this);
        const timestamp = this.timestamp.bind(this);
        const strictData = (v) => { return this.data(v, true); };
        formats.transaction = {
            hash: hash48,
            accessList: Formatter.allowNull(this.accessList.bind(this), null),
            from: address,
            gasLimit: bigNumber,
            to: Formatter.allowNull(address, null),
            value: bigNumber,
            data: data,
            r: Formatter.allowNull(this.uint256),
            s: Formatter.allowNull(this.uint256),
            v: Formatter.allowNull(number),
        };
        formats.transactionRequest = {
            from: Formatter.allowNull(address),
            nonce: Formatter.allowNull(number),
            gasLimit: Formatter.allowNull(bigNumber),
            gasPrice: Formatter.allowNull(bigNumber),
            maxPriorityFeePerGas: Formatter.allowNull(bigNumber),
            maxFeePerGas: Formatter.allowNull(bigNumber),
            to: Formatter.allowNull(address),
            value: Formatter.allowNull(bigNumber),
            data: Formatter.allowNull(strictData),
            type: Formatter.allowNull(number),
            accessList: Formatter.allowNull(this.accessList.bind(this), null),
        };
        formats.receiptLog = {
            transactionIndex: number,
            transactionHash: hash48,
            address: address,
            topics: Formatter.arrayOf(hash32),
            data: data,
            logIndex: number,
        };
        formats.receipt = {
            to: Formatter.allowNull(this.address, null),
            from: Formatter.allowNull(this.address, null),
            contractAddress: Formatter.allowNull(address, null),
            timestamp: timestamp,
            gasUsed: bigNumber,
            logsBloom: Formatter.allowNull(data),
            transactionHash: hash48,
            logs: Formatter.arrayOf(this.receiptLog.bind(this)),
            cumulativeGasUsed: bigNumber,
            status: Formatter.allowNull(number),
            type: type
        };
        formats.filter = {
            fromTimestamp: Formatter.allowNull(timestamp, undefined),
            toTimestamp: Formatter.allowNull(timestamp, undefined),
            address: Formatter.allowNull(address, undefined),
            topics: Formatter.allowNull(this.topics.bind(this), undefined),
        };
        formats.filterLog = {
            timestamp: timestamp,
            address: address,
            data: Formatter.allowFalsish(data, "0x"),
            topics: Formatter.arrayOf(hash32),
            transactionHash: Formatter.allowNull(hash48, undefined),
            logIndex: number,
            transactionIndex: number
        };
        return formats;
    }
    logsMapper(values) {
        let logs = [];
        values.forEach(function (log) {
            const mapped = {
                timestamp: log.timestamp,
                address: log.address,
                data: log.data,
                topics: log.topics,
                //@ts-ignore
                transactionHash: null,
                logIndex: log.index,
                transactionIndex: log.index,
            };
            logs.push(mapped);
        });
        return logs;
    }
    //TODO propper validation needed?
    timestamp(value) {
        if (!value.match(/([0-9]){10}[.]([0-9]){9}/)) {
            logger.throwArgumentError("bad timestamp format", "value", value);
        }
        return value;
    }
    accessList(accessList) {
        return accessListify(accessList || []);
    }
    // Requires a BigNumberish that is within the IEEE754 safe integer range; returns a number
    // Strict! Used on input.
    number(number) {
        if (number === "0x") {
            return 0;
        }
        return BigNumber.from(number).toNumber();
    }
    type(number) {
        if (number === "0x" || number == null) {
            return 0;
        }
        return BigNumber.from(number).toNumber();
    }
    // Strict! Used on input.
    bigNumber(value) {
        return BigNumber.from(value);
    }
    // Requires a boolean, "true" or  "false"; returns a boolean
    boolean(value) {
        if (typeof (value) === "boolean") {
            return value;
        }
        if (typeof (value) === "string") {
            value = value.toLowerCase();
            if (value === "true") {
                return true;
            }
            if (value === "false") {
                return false;
            }
        }
        throw new Error("invalid boolean - " + value);
    }
    hex(value, strict) {
        if (typeof (value) === "string") {
            if (!strict && value.substring(0, 2) !== "0x") {
                value = "0x" + value;
            }
            if (isHexString(value)) {
                return value.toLowerCase();
            }
        }
        return logger.throwArgumentError("invalid hash", "value", value);
    }
    data(value, strict) {
        const result = this.hex(value, strict);
        if ((result.length % 2) !== 0) {
            throw new Error("invalid data; odd-length - " + value);
        }
        return result;
    }
    // Requires an address
    // Strict! Used on input.
    address(value) {
        let address = value.toString();
        if (address.indexOf(".") !== -1) {
            address = getAddressFromAccount(address);
        }
        return getAddress(address);
    }
    callAddress(value) {
        if (!isHexString(value, 32)) {
            return null;
        }
        const address = getAddress(hexDataSlice(value, 12));
        return (address === AddressZero) ? null : address;
    }
    contractAddress(value) {
        return value;
    }
    // Requires a hash, optionally requires 0x prefix; returns prefixed lowercase hash.
    hash48(value, strict) {
        const result = this.hex(value, strict);
        if (hexDataLength(result) !== 48) {
            return logger.throwArgumentError("invalid hash", "value", value);
        }
        return result;
    }
    //hedera topics hash has length 32
    hash32(value, strict) {
        const result = this.hex(value, strict);
        if (hexDataLength(result) !== 32) {
            return logger.throwArgumentError("invalid topics hash", "value", value);
        }
        return result;
    }
    // Returns the difficulty as a number, or if too large (i.e. PoA network) null
    difficulty(value) {
        if (value == null) {
            return null;
        }
        const v = BigNumber.from(value);
        try {
            return v.toNumber();
        }
        catch (error) { }
        return null;
    }
    uint256(value) {
        if (!isHexString(value)) {
            throw new Error("invalid uint256");
        }
        return hexZeroPad(value, 32);
    }
    // Strict! Used on input.
    transactionRequest(value) {
        return Formatter.check(this.formats.transactionRequest, value);
    }
    transactionResponse(transaction) {
        // Rename gas to gasLimit
        if (transaction.gas != null && transaction.gasLimit == null) {
            transaction.gasLimit = transaction.gas;
        }
        // Some clients (TestRPC) do strange things like return 0x0 for the
        // 0 address; correct this to be a real address
        if (transaction.to && BigNumber.from(transaction.to).isZero()) {
            transaction.to = "0x0000000000000000000000000000000000000000";
        }
        // Rename input to data
        if (transaction.input != null && transaction.data == null) {
            transaction.data = transaction.input;
        }
        // If to and creates are empty, populate the creates from the transaction
        if (transaction.to == null && transaction.creates == null) {
            transaction.creates = this.contractAddress(transaction);
        }
        if ((transaction.type === 1 || transaction.type === 2) && transaction.accessList == null) {
            transaction.accessList = [];
        }
        const result = Formatter.check(this.formats.transaction, transaction);
        if (transaction.chainId != null) {
            let chainId = transaction.chainId;
            if (isHexString(chainId)) {
                chainId = BigNumber.from(chainId).toNumber();
            }
            result.chainId = chainId;
        }
        else {
            let chainId = transaction.networkId;
            // geth-etc returns chainId
            if (chainId == null && result.v == null) {
                chainId = transaction.chainId;
            }
            if (isHexString(chainId)) {
                chainId = BigNumber.from(chainId).toNumber();
            }
            if (typeof (chainId) !== "number" && result.v != null) {
                chainId = (result.v - 35) / 2;
                if (chainId < 0) {
                    chainId = 0;
                }
                chainId = parseInt(chainId);
            }
            if (typeof (chainId) !== "number") {
                chainId = 0;
            }
            result.chainId = chainId;
        }
        return result;
    }
    transaction(value) {
        return parseTransaction(value);
    }
    receiptLog(value) {
        return Formatter.check(this.formats.receiptLog, value);
    }
    receipt(value) {
        const result = Formatter.check(this.formats.receipt, value);
        if (result.status != null) {
            result.byzantium = true;
        }
        return result;
    }
    responseFromRecord(record) {
        return {
            chainId: record.chainId ? record.chainId : null,
            hash: record.hash,
            timestamp: record.timestamp,
            transactionId: record.transactionId ? record.transactionId : null,
            from: record.from,
            to: record.to ? record.to : null,
            data: record.call_result ? record.call_result : null,
            gasLimit: typeof record.gas_limit !== 'undefined' ? BigNumber.from(record.gas_limit) : null,
            value: BigNumber.from(record.amount || 0),
            customData: {
                gas_used: record.gas_used ? record.gas_used : null,
                logs: record.logs ? record.logs : null,
                result: record.result ? record.result : null,
                accountAddress: record.accountAddress ? record.accountAddress : null,
                transfersList: record.transfersList ? record.transfersList : [],
            },
            wait: null,
        };
    }
    receiptFromResponse(response) {
        var _a, _b, _c, _d, _e, _f;
        let contractAddress = null;
        let to = null;
        let logs = [];
        response.data != '0x' ? contractAddress = response.to : to = response.to;
        (_b = (_a = response.customData) === null || _a === void 0 ? void 0 : _a.logs) === null || _b === void 0 ? void 0 : _b.forEach(function (log) {
            const values = {
                timestamp: response.timestamp,
                address: log.address,
                data: log.data,
                topics: log.topics,
                transactionHash: response.hash,
                logIndex: log.index,
                transactionIndex: log.index,
            };
            logs.push(values);
        });
        return {
            to: to,
            from: response.from,
            timestamp: response.timestamp,
            contractAddress: contractAddress,
            gasUsed: (_c = response.customData) === null || _c === void 0 ? void 0 : _c.gas_used,
            logsBloom: null,
            transactionId: response.transactionId,
            transactionHash: response.hash,
            logs: logs,
            cumulativeGasUsed: (_d = response.customData) === null || _d === void 0 ? void 0 : _d.gas_used,
            type: 0,
            byzantium: true,
            status: ((_e = response.customData) === null || _e === void 0 ? void 0 : _e.result) === 'SUCCESS' ? 1 : 0,
            accountAddress: ((_f = response.customData) === null || _f === void 0 ? void 0 : _f.accountAddress) ? response.customData.accountAddress : null
        };
    }
    topics(value) {
        if (Array.isArray(value)) {
            return value.map((v) => this.topics(v));
        }
        else if (value != null) {
            return this.hash32(value, true);
        }
        return null;
    }
    filter(value) {
        return Formatter.check(this.formats.filter, value);
    }
    filterLog(value) {
        return Formatter.check(this.formats.filterLog, value);
    }
    static check(format, object) {
        const result = {};
        for (const key in format) {
            try {
                const value = format[key](object[key]);
                if (value !== undefined) {
                    result[key] = value;
                }
            }
            catch (error) {
                error.checkKey = key;
                error.checkValue = object[key];
                throw error;
            }
        }
        return result;
    }
    // if value is null-ish, nullValue is returned
    static allowNull(format, nullValue) {
        return (function (value) {
            if (value == null) {
                return nullValue;
            }
            return format(value);
        });
    }
    // If value is false-ish, replaceValue is returned
    static allowFalsish(format, replaceValue) {
        return (function (value) {
            if (!value) {
                return replaceValue;
            }
            return format(value);
        });
    }
    // Requires an Array satisfying check
    static arrayOf(format) {
        return (function (array) {
            if (!Array.isArray(array)) {
                throw new Error("not an array");
            }
            const result = [];
            array.forEach(function (value) {
                result.push(format(value));
            });
            return result;
        });
    }
}
//# sourceMappingURL=formatter.js.map