import { Competition, CompetitorRole } from '../types/competition';
import { JudgingSheet } from '../types/judging';

const STORAGE_KEY = 'wcs_competitions';
const JUDGING_STORAGE_KEY = 'wcs_judging_sheets';

class DB {
    private competitions: Competition[] = [];
    private judgingSheets: JudgingSheet[] = [];
    private initialized = false;

    async init() {
        if (this.initialized) return;
        
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            this.competitions = JSON.parse(stored);
        }

        const storedSheets = localStorage.getItem(JUDGING_STORAGE_KEY);
        if (storedSheets) {
            this.judgingSheets = JSON.parse(storedSheets);
        }

        this.initialized = true;
    }

    private async save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.competitions));
        localStorage.setItem(JUDGING_STORAGE_KEY, JSON.stringify(this.judgingSheets));
    }

    async getAllCompetitions(): Promise<Competition[]> {
        await this.init();
        return this.competitions;
    }

    async getCompetition(id: string): Promise<Competition | null> {
        await this.init();
        return this.competitions.find(c => c.id === id) || null;
    }

    async saveCompetition(competition: Competition): Promise<void> {
        await this.init();
        const index = this.competitions.findIndex(c => c.id === competition.id);
        if (index >= 0) {
            this.competitions[index] = competition;
        } else {
            this.competitions.push(competition);
        }
        await this.save();
    }

    async deleteCompetition(id: string): Promise<void> {
        await this.init();
        this.competitions = this.competitions.filter(c => c.id !== id);
        // Also delete associated judging sheets
        this.judgingSheets = this.judgingSheets.filter(s => s.competitionId !== id);
        await this.save();
    }

    async getJudgingSheet(competitionId: string, judgeId: string, role: CompetitorRole): Promise<JudgingSheet | null> {
        await this.init();
        return this.judgingSheets.find(s => 
            s.competitionId === competitionId && 
            s.judgeId === judgeId && 
            s.role === role
        ) || null;
    }

    async saveJudgingSheet(sheet: JudgingSheet): Promise<void> {
        await this.init();
        const index = this.judgingSheets.findIndex(s => 
            s.competitionId === sheet.competitionId && 
            s.judgeId === sheet.judgeId &&
            s.role === sheet.role
        );
        if (index >= 0) {
            this.judgingSheets[index] = sheet;
        } else {
            this.judgingSheets.push(sheet);
        }
        await this.save();
    }

    async getAllJudgingSheets(competitionId: string): Promise<JudgingSheet[]> {
        await this.init();
        return this.judgingSheets.filter(s => s.competitionId === competitionId);
    }
}

export const db = new DB(); 