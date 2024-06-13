/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * This sample is intended to work with the basic symptom transfer
 * chaincode which imposes some constraints on what is possible here.
 *
 * For example,
 *  - There is no validation for Symptom IDs
 *  - There are no error codes from the chaincode
 *
 * To avoid timeouts, long running tasks should be decoupled from HTTP request
 * processing
 *
 * Submit transactions can potentially be very long running, especially if the
 * transaction fails and needs to be retried one or more times
 *
 * To allow requests to respond quickly enough, this sample queues submit
 * requests for processing asynchronously and immediately returns 202 Accepted
 */

import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Contract } from 'fabric-network';
import { getReasonPhrase, StatusCodes } from 'http-status-codes';
import { Queue } from 'bullmq';
import { SymptomNotFoundError } from './errors';
import { evatuateTransaction } from './fabric';
import { addSubmitTransactionJob } from './jobs';
import { logger } from './logger';

const { ACCEPTED, BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } =
  StatusCodes;

export const symptomsRouter = express.Router();

symptomsRouter.get('/', async (req: Request, res: Response) => {
  logger.debug('Get all symptoms request received');
  try {
    const mspId = req.user as string;
    const contract = req.app.locals[mspId]?.symptomContract as Contract;

    const data = await evatuateTransaction(contract, 'GetAllSymptoms');
    let symptoms = [];
    if (data.length > 0) {
      symptoms = JSON.parse(data.toString());
    }

    return res.status(OK).json(symptoms);
  } catch (err) {
    logger.error({ err }, 'Error processing get all symptoms request');
    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});

symptomsRouter.post(
  '/',
  body().isObject().withMessage('body must contain an symptom object'),
  body('ID', 'must be a string').notEmpty(),
  body('Color', 'must be a string').notEmpty(),
  body('Size', 'must be a number').isNumeric(),
  body('Owner', 'must be a string').notEmpty(),
  body('AppraisedValue', 'must be a number').isNumeric(),
  async (req: Request, res: Response) => {
    logger.debug(req.body, 'Create symptom request received');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });
    }

    const mspId = req.user as string;
    const symptomId = req.body.ID;

    try {
      const submitQueue = req.app.locals.jobq as Queue;
      const jobId = await addSubmitTransactionJob(
        submitQueue,
        mspId,
        'CreateSymptom',
        symptomId,
        req.body.Color,
        req.body.Size,
        req.body.Owner,
        req.body.AppraisedValue
      );

      return res.status(ACCEPTED).json({
        status: getReasonPhrase(ACCEPTED),
        jobId: jobId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(
        { err },
        'Error processing create symptom request for symptom ID %s',
        symptomId
      );

      return res.status(INTERNAL_SERVER_ERROR).json({
        status: getReasonPhrase(INTERNAL_SERVER_ERROR),
        timestamp: new Date().toISOString(),
      });
    }
  }
);

symptomsRouter.options('/:symptomId', async (req: Request, res: Response) => {
  const symptomId = req.params.symptomId;
  logger.debug('Symptom options request received for symptom ID %s', symptomId);

  try {
    const mspId = req.user as string;
    const contract = req.app.locals[mspId]?.symptomContract as Contract;

    const data = await evatuateTransaction(contract, 'SymptomExists', symptomId);
    const exists = data.toString() === 'true';

    if (exists) {
      return res
        .status(OK)
        .set({
          Allow: 'DELETE,GET,OPTIONS,PATCH,PUT',
        })
        .json({
          status: getReasonPhrase(OK),
          timestamp: new Date().toISOString(),
        });
    } else {
      return res.status(NOT_FOUND).json({
        status: getReasonPhrase(NOT_FOUND),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error(
      { err },
      'Error processing symptom options request for symptom ID %s',
      symptomId
    );
    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});

symptomsRouter.get('/:symptomId', async (req: Request, res: Response) => {
  const symptomId = req.params.symptomId;
  logger.debug('Read symptom request received for symptom ID %s', symptomId);

  try {
    const mspId = req.user as string;
    const contract = req.app.locals[mspId]?.symptomContract as Contract;

    const data = await evatuateTransaction(contract, 'ReadSymptom', symptomId);
    const symptom = JSON.parse(data.toString());

    return res.status(OK).json(symptom);
  } catch (err) {
    logger.error(
      { err },
      'Error processing read symptom request for symptom ID %s',
      symptomId
    );

    if (err instanceof SymptomNotFoundError) {
      return res.status(NOT_FOUND).json({
        status: getReasonPhrase(NOT_FOUND),
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});

symptomsRouter.put(
  '/:symptomId',
  body().isObject().withMessage('body must contain an symptom object'),
  body('ID', 'must be a string').notEmpty(),
  body('Color', 'must be a string').notEmpty(),
  body('Size', 'must be a number').isNumeric(),
  body('Owner', 'must be a string').notEmpty(),
  body('AppraisedValue', 'must be a number').isNumeric(),
  async (req: Request, res: Response) => {
    logger.debug(req.body, 'Update symptom request received');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });
    }

    if (req.params.symptomId != req.body.ID) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'ASSET_ID_MISMATCH',
        message: 'Symptom IDs must match',
        timestamp: new Date().toISOString(),
      });
    }

    const mspId = req.user as string;
    const symptomId = req.params.symptomId;

    try {
      const submitQueue = req.app.locals.jobq as Queue;
      const jobId = await addSubmitTransactionJob(
        submitQueue,
        mspId,
        'UpdateSymptom',
        symptomId,
        req.body.color,
        req.body.size,
        req.body.owner,
        req.body.appraisedValue
      );

      return res.status(ACCEPTED).json({
        status: getReasonPhrase(ACCEPTED),
        jobId: jobId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(
        { err },
        'Error processing update symptom request for symptom ID %s',
        symptomId
      );

      return res.status(INTERNAL_SERVER_ERROR).json({
        status: getReasonPhrase(INTERNAL_SERVER_ERROR),
        timestamp: new Date().toISOString(),
      });
    }
  }
);

symptomsRouter.patch(
  '/:symptomId',
  body()
    .isArray({
      min: 1,
      max: 1,
    })
    .withMessage('body must contain an array with a single patch operation'),
  body('*.op', "operation must be 'replace'").equals('replace'),
  body('*.path', "path must be '/Owner'").equals('/Owner'),
  body('*.value', 'must be a string').isString(),
  async (req: Request, res: Response) => {
    logger.debug(req.body, 'Transfer symptom request received');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(BAD_REQUEST).json({
        status: getReasonPhrase(BAD_REQUEST),
        reason: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        timestamp: new Date().toISOString(),
        errors: errors.array(),
      });
    }

    const mspId = req.user as string;
    const symptomId = req.params.symptomId;
    const newOwner = req.body[0].value;

    try {
      const submitQueue = req.app.locals.jobq as Queue;
      const jobId = await addSubmitTransactionJob(
        submitQueue,
        mspId,
        'TransferSymptom',
        symptomId,
        newOwner
      );

      return res.status(ACCEPTED).json({
        status: getReasonPhrase(ACCEPTED),
        jobId: jobId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error(
        { err },
        'Error processing update symptom request for symptom ID %s',
        req.params.symptomId
      );

      return res.status(INTERNAL_SERVER_ERROR).json({
        status: getReasonPhrase(INTERNAL_SERVER_ERROR),
        timestamp: new Date().toISOString(),
      });
    }
  }
);

symptomsRouter.delete('/:symptomId', async (req: Request, res: Response) => {
  logger.debug(req.body, 'Delete symptom request received');

  const mspId = req.user as string;
  const symptomId = req.params.symptomId;

  try {
    const submitQueue = req.app.locals.jobq as Queue;
    const jobId = await addSubmitTransactionJob(
      submitQueue,
      mspId,
      'DeleteSymptom',
      symptomId
    );

    return res.status(ACCEPTED).json({
      status: getReasonPhrase(ACCEPTED),
      jobId: jobId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(
      { err },
      'Error processing delete symptom request for symptom ID %s',
      symptomId
    );

    return res.status(INTERNAL_SERVER_ERROR).json({
      status: getReasonPhrase(INTERNAL_SERVER_ERROR),
      timestamp: new Date().toISOString(),
    });
  }
});
