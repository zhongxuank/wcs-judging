export type CompetitorRole = 'Leader' | 'Follower';
export type JudgeRole = 'ChiefJudge' | 'Judge';
export type CompetitionStatus = 'pending' | 'active' | 'completed';
export type CompetitionType = 'Prelim' | 'Final';
export type JudgeStatus = 'pending' | 'submitted';

export interface Competitor {
    id: string;
    name: string;
    role: CompetitorRole;
    bibNumber: number;
}

export interface Judge {
    id: string;
    name: string;
    roles: CompetitorRole[];
    status: JudgeStatus;
    isChiefJudge: boolean;
}

export interface Competition {
    id: string;
    name: string;
    date: string;
    status: 'pending' | 'in_progress' | 'completed';
    judges: Judge[];
    competitors: Competitor[];
}

export type ResultType = 'YES' | 'NO' | 'ALT1' | 'ALT2' | 'ALT3';

export interface Score {
    bibNumber: string;
    rawScore: number;
    rank?: number;
    hasTie?: boolean;
    status?: 'YES' | 'ALT' | 'NO';
}

export interface JudgingScore {
    competitorId: string;
    score: number | null;
    calculatedResult?: ResultType;
}

export interface JudgingSheet {
    id: string;
    competitionId: string;
    judgeId: string;
    role: 'leader' | 'follower';
    scores: Score[];
    submitted: boolean;
}

export interface DB {
    getAllCompetitions: () => Promise<Competition[]>;
    getCompetition: (id: string) => Promise<Competition | null>;
    saveCompetition: (competition: Competition) => Promise<void>;
    deleteCompetition: (id: string) => Promise<void>;
    getJudgingSheet: (competitionId: string, judgeId: string, role: CompetitorRole) => Promise<JudgingSheet | null>;
    saveJudgingSheet: (sheet: JudgingSheet) => Promise<void>;
    getAllJudgingSheets: (competitionId: string) => Promise<JudgingSheet[]>;
} 