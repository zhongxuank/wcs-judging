import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, DocumentData } from 'firebase/firestore';
import { firestore } from './firebase';
import { Competition, JudgingSheet } from '../types/competition';

class DatabaseService {
    private competitionsCollection = collection(firestore, 'competitions');
    private judgingSheetsCollection = collection(firestore, 'judgingSheets');

    async getCompetition(id: string): Promise<Competition | null> {
        const docRef = doc(this.competitionsCollection, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as Competition;
    }

    async getCompetitions(): Promise<Competition[]> {
        const querySnapshot = await getDocs(this.competitionsCollection);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Competition);
    }

    async saveCompetition(competition: Competition): Promise<void> {
        const { id, ...data } = competition;
        await setDoc(doc(this.competitionsCollection, id), data);
    }

    async deleteCompetition(id: string): Promise<void> {
        // First delete all judging sheets for this competition
        const sheetsQuery = query(this.judgingSheetsCollection, where('competitionId', '==', id));
        const sheetsSnapshot = await getDocs(sheetsQuery);
        const deletePromises = sheetsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        // Then delete the competition
        await deleteDoc(doc(this.competitionsCollection, id));
    }

    async getJudgingSheet(id: string): Promise<JudgingSheet | null> {
        const docRef = doc(this.judgingSheetsCollection, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as JudgingSheet;
    }

    async getJudgingSheets(competitionId: string): Promise<JudgingSheet[]> {
        const sheetsQuery = query(this.judgingSheetsCollection, where('competitionId', '==', competitionId));
        const querySnapshot = await getDocs(sheetsQuery);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as JudgingSheet);
    }

    async saveJudgingSheet(sheet: JudgingSheet): Promise<void> {
        const { id, ...data } = sheet;
        await setDoc(doc(this.judgingSheetsCollection, id), data);
    }

    async deleteJudgingSheet(id: string): Promise<void> {
        await deleteDoc(doc(this.judgingSheetsCollection, id));
    }
}

export const db = new DatabaseService(); 