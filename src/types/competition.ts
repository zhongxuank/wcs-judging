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
    type: CompetitionType;
    status: CompetitionStatus;
    judges: Judge[];
    competitors: {
        [K in CompetitorRole]: Competitor[];
    };
    requiredYesCount: number;
    advancingCount: number;
    alternateCount: number;
}

export type ResultType = 'YES' | 'NO' | 'ALT1' | 'ALT2' | 'ALT3';

export interface Score {
    id: string;
    competitionId: string;
    judgeId: string;
    competitorId: string;
    rawScore: number;
    timestamp: number;
    calculatedResult?: number;
}

export interface JudgingScore {
    competitorId: string;
    score: number | null;
    calculatedResult?: ResultType;
}

export interface JudgingSheet {
    competitionId: string;
    judgeId: string;
    role: CompetitorRole;
    scores: JudgingScore[];
    isSubmitted: boolean;
    lastModified: number;
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