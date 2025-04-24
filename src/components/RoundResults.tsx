import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
} from '@mui/material';
import { Score, Competitor, Judge, ResultType } from '../types/competition';

interface RoundResultsProps {
    scores: Score[];
    competitors: Competitor[];
    judges: Judge[];
    advancingCompetitors: Competitor[];
}

const RoundResults: React.FC<RoundResultsProps> = ({
    scores,
    competitors,
    judges,
    advancingCompetitors,
}) => {
    const getCompetitorScores = (competitor: Competitor) => {
        return scores.filter((score) => score.competitorId === competitor.id);
    };

    const calculateTotalPoints = (competitorScores: Score[]) => {
        return competitorScores.reduce(
            (sum, score) => sum + (score.points || 0),
            0
        );
    };

    const getResultColor = (result: ResultType | undefined) => {
        switch (result) {
            case 'YES':
                return 'success';
            case 'ALT1':
            case 'ALT2':
            case 'ALT3':
                return 'warning';
            case 'NO':
                return 'error';
            default:
                return 'default';
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>
                Round Results
            </Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Bib #</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Role</TableCell>
                            {judges.map((judge) => (
                                <TableCell key={judge.id} align="center">
                                    {judge.name}
                                    {judge.isChiefJudge && ' (CJ)'}
                                </TableCell>
                            ))}
                            <TableCell align="center">Total Points</TableCell>
                            <TableCell align="center">Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {competitors.map((competitor) => {
                            const competitorScores = getCompetitorScores(
                                competitor
                            );
                            const totalPoints =
                                calculateTotalPoints(competitorScores);
                            const isAdvancing = advancingCompetitors.some(
                                (c) => c.id === competitor.id
                            );

                            return (
                                <TableRow
                                    key={competitor.id}
                                    sx={{
                                        backgroundColor: isAdvancing
                                            ? 'rgba(76, 175, 80, 0.1)'
                                            : 'inherit',
                                    }}
                                >
                                    <TableCell>{competitor.bibNumber}</TableCell>
                                    <TableCell>{competitor.name}</TableCell>
                                    <TableCell>{competitor.role}</TableCell>
                                    {judges.map((judge) => {
                                        const score = competitorScores.find(
                                            (s) => s.judgeId === judge.id
                                        );
                                        return (
                                            <TableCell
                                                key={judge.id}
                                                align="center"
                                            >
                                                {score?.rawScore.toFixed(1)}
                                                {score?.calculatedResult && (
                                                    <Chip
                                                        label={
                                                            score.calculatedResult
                                                        }
                                                        size="small"
                                                        color={getResultColor(
                                                            score.calculatedResult
                                                        )}
                                                        sx={{ ml: 1 }}
                                                    />
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                    <TableCell align="center">
                                        {totalPoints.toFixed(1)}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={
                                                isAdvancing
                                                    ? 'Advancing'
                                                    : 'Not Advancing'
                                            }
                                            color={
                                                isAdvancing
                                                    ? 'success'
                                                    : 'error'
                                            }
                                        />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default RoundResults; 