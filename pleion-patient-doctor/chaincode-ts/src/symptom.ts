

import {Object, Property} from 'fabric-contract-api';

@Object()
export class Symptom {

    @Property()
    public docType?: string;
    
    @Property()
    public ID!: string;

    @Property()
    public Comment!: string;

    @Property()
    public Owner!: string;

    @Property()
    public SymptomTimestamp!: number;
}