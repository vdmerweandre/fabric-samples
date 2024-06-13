/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * This file contains all the error handling for Fabric transactions, including
 * whether a transaction should be retried.
 */

import { TimeoutError, TransactionError } from 'fabric-network';
import { logger } from './logger';

/**
 * Base type for errors from the smart contract.
 *
 * These errors will not be retried.
 */
export class ContractError extends Error {
  transactionId: string;

  constructor(message: string, transactionId: string) {
    super(message);
    Object.setPrototypeOf(this, ContractError.prototype);

    this.name = 'TransactionError';
    this.transactionId = transactionId;
  }
}

/**
 * Represents the error which occurs when the transaction being submitted or
 * evaluated is not implemented in a smart contract.
 */
export class TransactionNotFoundError extends ContractError {
  constructor(message: string, transactionId: string) {
    super(message, transactionId);
    Object.setPrototypeOf(this, TransactionNotFoundError.prototype);

    this.name = 'TransactionNotFoundError';
  }
}

/**
 * Represents the error which occurs in the basic symptom transfer smart contract
 * implementation when an symptom already exists.
 */
export class SymptomExistsError extends ContractError {
  constructor(message: string, transactionId: string) {
    super(message, transactionId);
    Object.setPrototypeOf(this, SymptomExistsError.prototype);

    this.name = 'SymptomExistsError';
  }
}

/**
 * Represents the error which occurs in the basic symptom transfer smart contract
 * implementation when an symptom does not exist.
 */
export class SymptomNotFoundError extends ContractError {
  constructor(message: string, transactionId: string) {
    super(message, transactionId);
    Object.setPrototypeOf(this, SymptomNotFoundError.prototype);

    this.name = 'SymptomNotFoundError';
  }
}

/**
 * Enumeration of possible retry actions.
 */
export enum RetryAction {
  /**
   * Transactions should be retried using the same transaction ID to protect
   * against duplicate transactions being committed if a timeout error occurs
   */
  WithExistingTransactionId,

  /**
   * Transactions which could not be committed due to other errors require a
   * new transaction ID when retrying
   */
  WithNewTransactionId,

  /**
   * Transactions that failed due to a duplicate transaction error, or errors
   * from the smart contract, should not be retried
   */
  None,
}

/**
 * Get the required transaction retry action for an error.
 *
 * For this sample transactions are considered retriable if they fail with any
 * error, *except* for duplicate transaction errors, or errors from the smart
 * contract.
 *
 * You might decide to retry transactions which fail with specific errors
 * instead, for example:
 *   - MVCC_READ_CONFLICT
 *   - PHANTOM_READ_CONFLICT
 *   - ENDORSEMENT_POLICY_FAILURE
 *   - CHAINCODE_VERSION_CONFLICT
 *   - EXPIRED_CHAINCODE
 */
export const getRetryAction = (err: unknown): RetryAction => {
  if (isDuplicateTransactionError(err) || err instanceof ContractError) {
    return RetryAction.None;
  } else if (err instanceof TimeoutError) {
    return RetryAction.WithExistingTransactionId;
  }

  return RetryAction.WithNewTransactionId;
};

/**
 * Type guard to make catching unknown errors easier
 */
export const isErrorLike = (err: unknown): err is Error => {
  return (
    err != undefined &&
    err != null &&
    typeof (err as Error).name === 'string' &&
    typeof (err as Error).message === 'string' &&
    ((err as Error).stack === undefined ||
      typeof (err as Error).stack === 'string')
  );
};

/**
 * Checks whether an error was caused by a duplicate transaction.
 *
 * This is ...painful.
 */
export const isDuplicateTransactionError = (err: unknown): boolean => {
  logger.debug({ err }, 'Checking for duplicate transaction error');

  if (err === undefined || err === null) return false;

  let isDuplicate;
  if (typeof (err as TransactionError).transactionCode === 'string') {
    // Checking whether a commit failure is caused by a duplicate transaction
    // is straightforward because the transaction code should be available
    isDuplicate =
      (err as TransactionError).transactionCode === 'DUPLICATE_TXID';
  } else {
    // Checking whether an endorsement failure is caused by a duplicate
    // transaction is only possible by processing error strings, which is not ideal.
    const endorsementError = err as {
      errors: { endorsements: { details: string }[] }[];
    };

    isDuplicate = endorsementError?.errors?.some((err) =>
      err?.endorsements?.some((endorsement) =>
        endorsement?.details?.startsWith('duplicate transaction found')
      )
    );
  }

  return isDuplicate === true;
};

/**
 * Matches symptom already exists error strings from the symptom contract
 *
 * The regex needs to match the following error messages:
 *   - "the symptom %s already exists"
 *   - "The symptom ${id} already exists"
 *   - "Symptom %s already exists"
 */
const matchSymptomAlreadyExistsMessage = (message: string): string | null => {
  const symptomAlreadyExistsRegex = /([tT]he )?[aA]sset \w* already exists/g;
  const symptomAlreadyExistsMatch = message.match(symptomAlreadyExistsRegex);
  logger.debug(
    { message: message, result: symptomAlreadyExistsMatch },
    'Checking for symptom already exists message'
  );

  if (symptomAlreadyExistsMatch !== null) {
    return symptomAlreadyExistsMatch[0];
  }

  return null;
};

/**
 * Matches symptom does not exist error strings from the symptom contract
 *
 * The regex needs to match the following error messages:
 *   - "the symptom %s does not exist"
 *   - "The symptom ${id} does not exist"
 *   - "Symptom %s does not exist"
 */
const matchSymptomDoesNotExistMessage = (message: string): string | null => {
  const symptomDoesNotExistRegex = /([tT]he )?[aA]sset \w* does not exist/g;
  const symptomDoesNotExistMatch = message.match(symptomDoesNotExistRegex);
  logger.debug(
    { message: message, result: symptomDoesNotExistMatch },
    'Checking for symptom does not exist message'
  );

  if (symptomDoesNotExistMatch !== null) {
    return symptomDoesNotExistMatch[0];
  }

  return null;
};

/**
 * Matches transaction does not exist error strings from the contract API
 *
 * The regex needs to match the following error messages:
 *   - "Failed to get transaction with id %s, error Entry not found in index"
 *   - "Failed to get transaction with id %s, error no such transaction ID [%s] in index"
 */
const matchTransactionDoesNotExistMessage = (
  message: string
): string | null => {
  const transactionDoesNotExistRegex =
    /Failed to get transaction with id [^,]*, error (?:(?:Entry not found)|(?:no such transaction ID \[[^\]]*\])) in index/g;
  const transactionDoesNotExistMatch = message.match(
    transactionDoesNotExistRegex
  );
  logger.debug(
    { message: message, result: transactionDoesNotExistMatch },
    'Checking for transaction does not exist message'
  );

  if (transactionDoesNotExistMatch !== null) {
    return transactionDoesNotExistMatch[0];
  }

  return null;
};

/**
 * Handles errors from evaluating and submitting transactions.
 *
 * Smart contract errors from the basic symptom transfer samples do not use
 * error codes so matching strings is the only option, which is not ideal.
 *
 * Note: the error message text is not the same for the Go, Java, and
 * Javascript implementations of the chaincode!
 */
export const handleError = (
  transactionId: string,
  err: unknown
): Error | unknown => {
  logger.debug({ transactionId: transactionId, err }, 'Processing error');

  if (isErrorLike(err)) {
    const symptomAlreadyExistsMatch = matchSymptomAlreadyExistsMessage(err.message);
    if (symptomAlreadyExistsMatch !== null) {
      return new SymptomExistsError(symptomAlreadyExistsMatch, transactionId);
    }

    const symptomDoesNotExistMatch = matchSymptomDoesNotExistMessage(err.message);
    if (symptomDoesNotExistMatch !== null) {
      return new SymptomNotFoundError(symptomDoesNotExistMatch, transactionId);
    }

    const transactionDoesNotExistMatch = matchTransactionDoesNotExistMessage(
      err.message
    );
    if (transactionDoesNotExistMatch !== null) {
      return new TransactionNotFoundError(
        transactionDoesNotExistMatch,
        transactionId
      );
    }
  }

  return err;
};
