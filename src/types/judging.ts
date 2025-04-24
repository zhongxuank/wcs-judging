import { CompetitorRole, ResultType } from './competition';

export interface CompetitorScore {
    competitorId: string;
    rawScore: number | null;
    calculatedResult?: ResultType;
    rank: number;
    tiedWith: string[];
}

export interface JudgingSheet {
    competitionId: string;
    judgeId: string;
    role: CompetitorRole;
    scores: CompetitorScore[];
    isSubmitted: boolean;
    lastModified: number;
}

export interface TieInfo {
    competitorIds: string[];
    type: 'yes_alt1' | 'between_alts' | 'alt3_no' | 'chief_judge';
    affectedPositions: string[];  // e.g. ["YES", "ALT1"] or ["ALT1", "ALT2"]
}

export interface JudgingState {
    currentRole: CompetitorRole;
    judgingSheet: JudgingSheet;
    tieBreakers: TieInfo[];
    isDirty: boolean;  // Whether there are unsaved changes
} 