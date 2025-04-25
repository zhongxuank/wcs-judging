import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, DocumentData, Firestore, CollectionReference, Timestamp } from 'firebase/firestore';
import { firestore } from './firebase';
import { Competition } from '../types/competition';
import { JudgingSheet } from '../types/judging';

class DatabaseService {
    private competitionsCollection: CollectionReference<DocumentData>;
    private judgingSheetsCollection: CollectionReference<DocumentData>;

    constructor() {
        if (!firestore) {
            throw new Error('Firestore is not initialized');
        }
        this.competitionsCollection = collection(firestore, 'competitions');
        this.judgingSheetsCollection = collection(firestore, 'judgingSheets');
    }

    async getCompetition(id: string): Promise<Competition | null> {
        try {
            const docRef = doc(this.competitionsCollection, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Competition;
            }
            return null;
        } catch (error) {
            console.error('Error getting competition:', error);
            throw error;
        }
    }

    async getCompetitions(): Promise<Competition[]> {
        try {
            const querySnapshot = await getDocs(this.competitionsCollection);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
        } catch (error) {
            console.error('Error getting competitions:', error);
            throw error;
        }
    }

    async saveCompetition(competition: Competition): Promise<void> {
        try {
            const { id, ...competitionData } = competition;
            await setDoc(doc(this.competitionsCollection, id), competitionData);
        } catch (error) {
            console.error('Error saving competition:', error);
            throw error;
        }
    }

    async deleteCompetition(id: string): Promise<void> {
        try {
            await deleteDoc(doc(this.competitionsCollection, id));
        } catch (error) {
            console.error('Error deleting competition:', error);
            throw error;
        }
    }

    async getJudgingSheet(competitionId: string, judgeId: string, role: string): Promise<JudgingSheet | null> {
        try {
            const q = query(
                this.judgingSheetsCollection,
                where('competitionId', '==', competitionId),
                where('judgeId', '==', judgeId),
                where('role', '==', role.toLowerCase())
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() } as JudgingSheet;
            }
            return null;
        } catch (error) {
            console.error('Error getting judging sheet:', error);
            throw error;
        }
    }

    async getJudgingSheets(competitionId: string, role: string): Promise<JudgingSheet[]> {
        try {
            const q = query(
                this.judgingSheetsCollection,
                where('competitionId', '==', competitionId),
                where('role', '==', role.toLowerCase())
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JudgingSheet));
        } catch (error) {
            console.error('Error getting judging sheets:', error);
            throw error;
        }
    }

    async saveJudgingSheet(judgingSheet: JudgingSheet): Promise<void> {
        try {
            const { id, ...sheetData } = judgingSheet;
            const now = Timestamp.now();
            
            await setDoc(doc(this.judgingSheetsCollection, id), {
                ...sheetData,
                role: sheetData.role.toLowerCase(),
                updatedAt: now,
                createdAt: sheetData.createdAt || now
            });
        } catch (error) {
            console.error('Error saving judging sheet:', error);
            throw error;
        }
    }

    async deleteJudgingSheet(id: string): Promise<void> {
        try {
            await deleteDoc(doc(this.judgingSheetsCollection, id));
        } catch (error) {
            console.error('Error deleting judging sheet:', error);
            throw error;
        }
    }
}

export const db = new DatabaseService(); 