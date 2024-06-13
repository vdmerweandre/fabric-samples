import {Context, Contract, Info, Returns, Transaction} from 'fabric-contract-api';
import {Symptom} from './symptom';

@Info({title: 'SymptomTransfer', description: 'Smart contract for transfering symptoms'})
export class SymptomTransferContract extends Contract {

    @Transaction()
    public async InitLedger(ctx: Context): Promise<void> {
        const symptoms: Symptom[] = [
            {
                ID: 'symptom1',
                Comment: 'Heart ache',
                Owner: 'Brad',
                SymptomTimestamp: new Date().getTime()
            },
            {
                ID: 'symptom1',
                Comment: 'Stomach pain',
                Owner: 'Brad',
                SymptomTimestamp: new Date().getTime()
            }
        ];

        for (const symptom of symptoms) {
            symptom.docType = 'symptom';
            await ctx.stub.putState(symptom.ID, Buffer.from(JSON.stringify(symptom)));
            console.info(`Asset ${symptom.ID} initialized`);
        }
    }

    // CreateSymptom issues a new symptom to the world state with given details.
    @Transaction()
    public async CreateSymptom(ctx: Context, id: string, comment: string, owner: string, symptomTimestamp: number): Promise<void> {
        const symptom = {
            ID: id,
            Comment: comment,
            Owner: owner,
            SymptomTimestamp: symptomTimestamp,
        };
        await ctx.stub.putState(id, Buffer.from(JSON.stringify(symptom)));
    }

    // ReadSymptom returns the asset stored in the world state with given id.
    @Transaction(false)
    public async ReadSymptom(ctx: Context, id: string): Promise<string> {
        const symptomJSON = await ctx.stub.getState(id); // get the symptom from chaincode state
        if (!symptomJSON || symptomJSON.length === 0) {
            throw new Error(`The symptom ${id} does not exist`);
        }
        return symptomJSON.toString();
    }

    // UpdateSymptom updates an existing symptom in the world state with provided parameters.
    @Transaction()
    public async UpdateSymptom(ctx: Context, id: string, comment: string, owner: string, symptomTimestamp: number): Promise<void> {
        const exists = await this.SymptomExists(ctx, id);
        if (!exists) {
            throw new Error(`The symptom ${id} does not exist`);
        }

        // overwriting original symptom with new symptom
        const updatedSymptom = {
            ID: id,
            Comment: comment,
            Owner: owner,
            SymptomTimestamp: symptomTimestamp,
        };
        return ctx.stub.putState(id, Buffer.from(JSON.stringify(updatedSymptom)));
    }

    // DeleteSymptom deletes an given symptom from the world state.
    @Transaction()
    public async DeleteSymptom(ctx: Context, id: string): Promise<void> {
        const exists = await this.SymptomExists(ctx, id);
        if (!exists) {
            throw new Error(`The symptom ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    // SymptomExists returns true when symptom with given ID exists in world state.
    @Transaction(false)
    @Returns('boolean')
    public async SymptomExists(ctx: Context, id: string): Promise<boolean> {
        const symptomJSON = await ctx.stub.getState(id);
        return symptomJSON && symptomJSON.length > 0;
    }

    // GetAllSymptoms returns all symptoms found in the world state.
    @Transaction(false)
    @Returns('string')
    public async GetAllSymptoms(ctx: Context): Promise<string> {
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all symptoms in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push({Key: result.value.key, Record: record});
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
}