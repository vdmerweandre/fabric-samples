/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Job, Queue } from 'bullmq';
import { Application } from 'express';
import { Contract, Transaction } from 'fabric-network';
import * as fabricProtos from 'fabric-protos';
import { mock, MockProxy } from 'jest-mock-extended';
import { jest } from '@jest/globals';
import request from 'supertest';
import * as config from '../config';
import { createServer } from '../server';

jest.mock('../config');
jest.mock('bullmq');

const mockSymptom1 = {
  ID: 'symptom1',
  Color: 'blue',
  Size: 5,
  Owner: 'Tomoko',
  AppraisedValue: 300,
};
const mockSymptom1Buffer = Buffer.from(JSON.stringify(mockSymptom1));

const mockSymptom2 = {
  ID: 'symptom2',
  Color: 'red',
  Size: 5,
  Owner: 'Brad',
  AppraisedValue: 400,
};

const mockAllSymptomsBuffer = Buffer.from(
  JSON.stringify([mockSymptom1, mockSymptom2])
);

// TODO add tests for server errors
describe('Symptom Transfer Besic REST API', () => {
  let app: Application;
  let mockJobQueue: MockProxy<Queue>;

  beforeEach(async () => {
    app = await createServer();

    const mockJob = mock<Job>();
    mockJob.id = '1';
    mockJobQueue = mock<Queue>();
    mockJobQueue.add.mockResolvedValue(mockJob);
    app.locals.jobq = mockJobQueue;
  });

  describe('/ready', () => {
    it('GET should respond with 200 OK json', async () => {
      const response = await request(app).get('/ready');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
      });
    });
  });

  describe('/live', () => {
    it('GET should respond with 200 OK json', async () => {
      const mockBlockchainInfoProto =
        fabricProtos.common.BlockchainInfo.create();
      mockBlockchainInfoProto.height = 42;
      const mockBlockchainInfoBuffer = Buffer.from(
        fabricProtos.common.BlockchainInfo.encode(
          mockBlockchainInfoProto
        ).finish()
      );

      const mockOrg1QsccContract = mock<Contract>();
      mockOrg1QsccContract.evaluateTransaction
        .calledWith('GetChainInfo')
        .mockResolvedValue(mockBlockchainInfoBuffer);
      app.locals[config.mspIdOrg1] = {
        qsccContract: mockOrg1QsccContract,
      };

      const mockOrg2QsccContract = mock<Contract>();
      mockOrg2QsccContract.evaluateTransaction
        .calledWith('GetChainInfo')
        .mockResolvedValue(mockBlockchainInfoBuffer);
      app.locals[config.mspIdOrg2] = {
        qsccContract: mockOrg2QsccContract,
      };

      const response = await request(app).get('/live');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
      });
    });
  });

  describe('/api/symptoms', () => {
    let mockGetAllSymptomsTransaction: MockProxy<Transaction>;

    beforeEach(() => {
      mockGetAllSymptomsTransaction = mock<Transaction>();
      const mockBasicContract = mock<Contract>();
      mockBasicContract.createTransaction
        .calledWith('GetAllSymptoms')
        .mockReturnValue(mockGetAllSymptomsTransaction);
      app.locals[config.mspIdOrg1] = {
        symptomContract: mockBasicContract,
      };
    });

    it('GET should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .get('/api/symptoms')
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with an empty json array when there are no symptoms', async () => {
      mockGetAllSymptomsTransaction.evaluate.mockResolvedValue(Buffer.from(''));

      const response = await request(app)
        .get('/api/symptoms')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual([]);
    });

    it('GET should respond with json array of symptoms', async () => {
      mockGetAllSymptomsTransaction.evaluate.mockResolvedValue(
        mockAllSymptomsBuffer
      );

      const response = await request(app)
        .get('/api/symptoms')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual([
        {
          ID: 'symptom1',
          Color: 'blue',
          Size: 5,
          Owner: 'Tomoko',
          AppraisedValue: 300,
        },
        {
          ID: 'symptom2',
          Color: 'red',
          Size: 5,
          Owner: 'Brad',
          AppraisedValue: 400,
        },
      ]);
    });

    it('POST should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .post('/api/symptoms')
        .send({
          ID: 'symptom6',
          Color: 'white',
          Size: 15,
          Owner: 'Michel',
          AppraisedValue: 800,
        })
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('POST should respond with 400 bad request json for invalid symptom json', async () => {
      const response = await request(app)
        .post('/api/symptoms')
        .send({
          wrongidfield: 'symptom3',
          Color: 'red',
          Size: 5,
          Owner: 'Brad',
          AppraisedValue: 400,
        })
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(400);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Bad Request',
        reason: 'VALIDATION_ERROR',
        errors: [
          {
            location: 'body',
            msg: 'must be a string',
            param: 'ID',
          },
        ],
        message: 'Invalid request body',
        timestamp: expect.any(String),
      });
    });

    it('POST should respond with 202 accepted json', async () => {
      const response = await request(app)
        .post('/api/symptoms')
        .send({
          ID: 'symptom3',
          Color: 'red',
          Size: 5,
          Owner: 'Brad',
          AppraisedValue: 400,
        })
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(202);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Accepted',
        jobId: '1',
        timestamp: expect.any(String),
      });
    });
  });

  describe('/api/symptoms/:id', () => {
    let mockSymptomExistsTransaction: MockProxy<Transaction>;
    let mockReadSymptomTransaction: MockProxy<Transaction>;

    beforeEach(() => {
      const mockBasicContract = mock<Contract>();

      mockSymptomExistsTransaction = mock<Transaction>();
      mockBasicContract.createTransaction
        .calledWith('SymptomExists')
        .mockReturnValue(mockSymptomExistsTransaction);

      mockReadSymptomTransaction = mock<Transaction>();
      mockBasicContract.createTransaction
        .calledWith('ReadSymptom')
        .mockReturnValue(mockReadSymptomTransaction);

      app.locals[config.mspIdOrg1] = {
        symptomContract: mockBasicContract,
      };
    });

    it('OPTIONS should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .options('/api/symptoms/symptom1')
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('OPTIONS should respond with 404 not found json without the allow header when there is no symptom with the specified ID', async () => {
      mockSymptomExistsTransaction.evaluate
        .calledWith('symptom3')
        .mockResolvedValue(Buffer.from('false'));

      const response = await request(app)
        .options('/api/symptoms/symptom3')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(404);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.header).not.toHaveProperty('allow');
      expect(response.body).toEqual({
        status: 'Not Found',
        timestamp: expect.any(String),
      });
    });

    it('OPTIONS should respond with 200 OK json with the allow header', async () => {
      mockSymptomExistsTransaction.evaluate
        .calledWith('symptom1')
        .mockResolvedValue(Buffer.from('true'));

      const response = await request(app)
        .options('/api/symptoms/symptom1')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.header).toHaveProperty(
        'allow',
        'DELETE,GET,OPTIONS,PATCH,PUT'
      );
      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .get('/api/symptoms/symptom1')
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with 404 not found json when there is no symptom with the specified ID', async () => {
      mockReadSymptomTransaction.evaluate
        .calledWith('symptom3')
        .mockRejectedValue(new Error('the symptom symptom3 does not exist'));

      const response = await request(app)
        .get('/api/symptoms/symptom3')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(404);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Not Found',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with the symptom json when the symptom exists', async () => {
      mockReadSymptomTransaction.evaluate
        .calledWith('symptom1')
        .mockResolvedValue(mockSymptom1Buffer);

      const response = await request(app)
        .get('/api/symptoms/symptom1')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        ID: 'symptom1',
        Color: 'blue',
        Size: 5,
        Owner: 'Tomoko',
        AppraisedValue: 300,
      });
    });

    it('PUT should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .put('/api/symptoms/symptom1')
        .send({
          ID: 'symptom3',
          Color: 'red',
          Size: 5,
          Owner: 'Brad',
          AppraisedValue: 400,
        })
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('PUT should respond with 400 bad request json when IDs do not match', async () => {
      const response = await request(app)
        .put('/api/symptoms/symptom1')
        .send({
          ID: 'symptom2',
          Color: 'red',
          Size: 5,
          Owner: 'Brad',
          AppraisedValue: 400,
        })
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(400);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Bad Request',
        reason: 'ASSET_ID_MISMATCH',
        message: 'Symptom IDs must match',
        timestamp: expect.any(String),
      });
    });

    it('PUT should respond with 400 bad request json for invalid symptom json', async () => {
      const response = await request(app)
        .put('/api/symptoms/symptom1')
        .send({
          wrongID: 'symptom1',
          Color: 'red',
          Size: 5,
          Owner: 'Brad',
          AppraisedValue: 400,
        })
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(400);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Bad Request',
        reason: 'VALIDATION_ERROR',
        errors: [
          {
            location: 'body',
            msg: 'must be a string',
            param: 'ID',
          },
        ],
        message: 'Invalid request body',
        timestamp: expect.any(String),
      });
    });

    it('PUT should respond with 202 accepted json', async () => {
      const response = await request(app)
        .put('/api/symptoms/symptom1')
        .send({
          ID: 'symptom1',
          Color: 'red',
          Size: 5,
          Owner: 'Brad',
          AppraisedValue: 400,
        })
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(202);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Accepted',
        jobId: '1',
        timestamp: expect.any(String),
      });
    });

    it('PATCH should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .patch('/api/symptoms/symptom1')
        .send([{ op: 'replace', path: '/Owner', value: 'Ashleigh' }])
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('PATCH should respond with 400 bad request json for invalid patch op/path', async () => {
      const response = await request(app)
        .patch('/api/symptoms/symptom1')
        .send([{ op: 'replace', path: '/color', value: 'orange' }])
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(400);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Bad Request',
        reason: 'VALIDATION_ERROR',
        errors: [
          {
            location: 'body',
            msg: "path must be '/Owner'",
            param: '[0].path',
            value: '/color',
          },
        ],
        message: 'Invalid request body',
        timestamp: expect.any(String),
      });
    });

    it('PATCH should respond with 202 accepted json', async () => {
      const response = await request(app)
        .patch('/api/symptoms/symptom1')
        .send([{ op: 'replace', path: '/Owner', value: 'Ashleigh' }])
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(202);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Accepted',
        jobId: '1',
        timestamp: expect.any(String),
      });
    });

    it('DELETE should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .delete('/api/symptoms/symptom1')
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('DELETE should respond with 202 accepted json', async () => {
      const response = await request(app)
        .delete('/api/symptoms/symptom1')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(202);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Accepted',
        jobId: '1',
        timestamp: expect.any(String),
      });
    });
  });

  describe('/api/jobs/:id', () => {
    it('GET should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .get('/api/jobs/1')
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with 404 not found json when there is no job with the specified ID', async () => {
      jest.mocked(Job.fromId).mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/jobs/3')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(404);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Not Found',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with json details for the specified job ID', async () => {
      const mockJob = mock<Job>();
      mockJob.id = '2';
      mockJob.data = {
        transactionIds: ['txn1', 'txn2'],
      };
      mockJob.returnvalue = {
        transactionError: 'Mock error',
        transactionPayload: Buffer.from('Mock payload'),
      };
      mockJobQueue.getJob.calledWith('2').mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/jobs/2')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        jobId: '2',
        transactionIds: ['txn1', 'txn2'],
        transactionError: 'Mock error',
        transactionPayload: 'Mock payload',
      });
    });
  });

  describe('/api/transactions/:id', () => {
    let mockGetTransactionByIDTransaction: MockProxy<Transaction>;

    beforeEach(() => {
      mockGetTransactionByIDTransaction = mock<Transaction>();
      const mockQsccContract = mock<Contract>();
      mockQsccContract.createTransaction
        .calledWith('GetTransactionByID')
        .mockReturnValue(mockGetTransactionByIDTransaction);
      app.locals[config.mspIdOrg1] = {
        qsccContract: mockQsccContract,
      };
    });

    it('GET should respond with 401 unauthorized json when an invalid API key is specified', async () => {
      const response = await request(app)
        .get('/api/transactions/txn1')
        .set('X-Api-Key', 'NOTTHERIGHTAPIKEY');
      expect(response.statusCode).toEqual(401);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        reason: 'NO_VALID_APIKEY',
        status: 'Unauthorized',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with 404 not found json when there is no transaction with the specified ID', async () => {
      mockGetTransactionByIDTransaction.evaluate
        .calledWith('mychannel', 'txn3')
        .mockRejectedValue(
          new Error(
            'Failed to get transaction with id txn3, error Entry not found in index'
          )
        );

      const response = await request(app)
        .get('/api/transactions/txn3')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(404);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        status: 'Not Found',
        timestamp: expect.any(String),
      });
    });

    it('GET should respond with json details for the specified transaction ID', async () => {
      const processedTransactionProto =
        fabricProtos.protos.ProcessedTransaction.create();
      processedTransactionProto.validationCode =
        fabricProtos.protos.TxValidationCode.VALID;
      const processedTransactionBuffer = Buffer.from(
        fabricProtos.protos.ProcessedTransaction.encode(
          processedTransactionProto
        ).finish()
      );
      mockGetTransactionByIDTransaction.evaluate
        .calledWith('mychannel', 'txn2')
        .mockResolvedValue(processedTransactionBuffer);

      const response = await request(app)
        .get('/api/transactions/txn2')
        .set('X-Api-Key', 'ORG1MOCKAPIKEY');
      expect(response.statusCode).toEqual(200);
      expect(response.header).toHaveProperty(
        'content-type',
        'application/json; charset=utf-8'
      );
      expect(response.body).toEqual({
        transactionId: 'txn2',
        validationCode: 'VALID',
      });
    });
  });
});
