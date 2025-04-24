import { Score, Competitor, Judge } from '../types/competition';

export const POINTS = {
    YES: 10,
    ALT1: 4.5,
    ALT2: 4.3,
    ALT3: 4.2,
    NO: 0,
} as const;

type ResultType = keyof typeof POINTS;

export const calculateResults = (
    scores: Score[],
    competitors: Competitor[],
    judges: Judge[],
    requiredYesCount: number
): Score[] => {
    // Group scores by competitor
    const scoresByCompetitor = competitors.map((competitor) => {
        const competitorScores = scores.filter(
            (score) => score.competitorId === competitor.id
        );
        const avgScore =
            competitorScores.reduce((sum, score) => sum + score.rawScore, 0) /
            competitorScores.length;
        return {
            competitor,
            avgScore,
            scores: competitorScores,
        };
    });

    // Sort competitors by average score
    scoresByCompetitor.sort((a, b) => b.avgScore - a.avgScore);

    // Assign results based on ranking
    const updatedScores = [...scores];
    scoresByCompetitor.forEach((item, index) => {
        const result: ResultType =
            index < requiredYesCount
                ? 'YES'
                : index === requiredYesCount
                ? 'ALT1'
                : index === requiredYesCount + 1
                ? 'ALT2'
                : index === requiredYesCount + 2
                ? 'ALT3'
                : 'NO';

        item.scores.forEach((score) => {
            const scoreIndex = updatedScores.findIndex(
                (s) =>
                    s.competitorId === score.competitorId &&
                    s.judgeId === score.judgeId
            );
            if (scoreIndex !== -1) {
                updatedScores[scoreIndex] = {
                    ...updatedScores[scoreIndex],
                    calculatedResult: result,
                    points: POINTS[result],
                };
            }
        });
    });

    return updatedScores;
};

export const determineAdvancing = (
    scores: Score[],
    competitors: Competitor[],
    advancingCount: number,
    chiefJudge: Judge
): Competitor[] => {
    // Calculate total points for each competitor
    const competitorPoints = competitors.map((competitor) => {
        const competitorScores = scores.filter(
            (score) => score.competitorId === competitor.id
        );
        const totalPoints = competitorScores.reduce(
            (sum, score) => sum + (score.points || 0),
            0
        );
        return {
            competitor,
            totalPoints,
            chiefJudgeScore: competitorScores.find(
                (score) => score.judgeId === chiefJudge.id
            )?.rawScore,
        };
    });

    // Sort by total points, using chief judge's score as tiebreaker
    competitorPoints.sort((a, b) => {
        if (a.totalPoints !== b.totalPoints) {
            return b.totalPoints - a.totalPoints;
        }
        return (b.chiefJudgeScore || 0) - (a.chiefJudgeScore || 0);
    });

    // Return the top competitors
    return competitorPoints
        .slice(0, advancingCount)
        .map((item) => item.competitor);
}; 