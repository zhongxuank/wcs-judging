import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemText,
    Slider,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import { Competition, Judge, CompetitorRole, JudgeStatus, ResultType } from '../types/competition';
import { JudgingSheet as JudgingSheetType, CompetitorScore, TieInfo } from '../types/judging';
import { db } from '../services/db';

interface JudgingSheetProps {
    competition: Competition;
    judge: Judge;
}

interface JudgingState {
    currentRole: CompetitorRole;
    scoresByRole: {
        [role in CompetitorRole]?: CompetitorScore[];
    };
    tieBreakers: TieInfo[];
    submitted: boolean;
    sortedScores: CompetitorScore[];
}

const JudgingSheet: React.FC<JudgingSheetProps> = ({ competition, judge }) => {
    const [state, setState] = useState<JudgingState>({
        currentRole: judge.roles[0],
        scoresByRole: {
            [judge.roles[0]]: competition.competitors[judge.roles[0]]
                .sort((a, b) => a.bibNumber - b.bibNumber)
                .map(c => ({
                    competitorId: c.id,
                    rawScore: null,
                    rank: 0,
                    tiedWith: [],
                }))
        },
        tieBreakers: [],
        submitted: false,
        sortedScores: [],
    });
    const [error, setError] = useState<string | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    // Create a debounced version of calculateRanksAndTies
    const debouncedCalculateRanks = useCallback(() => {
        const timeoutId = setTimeout(() => {
            setState(prev => {
                const currentScores = prev.scoresByRole[prev.currentRole] || [];
                const [updatedScores, newTieBreakers] = calculateRanksAndTies(currentScores);
                return {
                    ...prev,
                    scoresByRole: {
                        ...prev.scoresByRole,
                        [prev.currentRole]: updatedScores
                    },
                    tieBreakers: newTieBreakers,
                };
            });
        }, 50); // 50ms debounce delay

        return () => clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        // Initialize scores for all roles if chief judge, otherwise just current role
        const rolesToInitialize = judge.isChiefJudge ? judge.roles : [state.currentRole];
        
        const initialScoresByRole: Required<JudgingState['scoresByRole']> = { 
            ...state.scoresByRole,
            Leader: state.scoresByRole.Leader || [],
            Follower: state.scoresByRole.Follower || []
        };
        
        rolesToInitialize.forEach(role => {
            // Skip if scores already exist for this role
            if (initialScoresByRole[role].length > 0) return;
            
            const competitors = competition.competitors[role]
                .sort((a, b) => a.bibNumber - b.bibNumber);
            const initialScores = competitors.map(c => ({
                competitorId: c.id,
                rawScore: null,
                rank: 0,
                tiedWith: [],
            }));
            
            // Calculate initial ranks
            const [rankedScores] = calculateRanksAndTies(initialScores);
            
            initialScoresByRole[role] = rankedScores;
        });
        
        setState(prev => ({
            ...prev,
            scoresByRole: initialScoresByRole,
            tieBreakers: [],  // Reset tie breakers when switching roles
        }));
    }, [state.currentRole, competition.competitors, judge.isChiefJudge, judge.roles]);

    const handleRoleChange = (_: React.SyntheticEvent, newRole: CompetitorRole) => {
        setState(prev => ({
            ...prev,
            currentRole: newRole,
        }));
    };

    const calculateRanksAndTies = (scores: CompetitorScore[]): [CompetitorScore[], TieInfo[]] => {
        // Filter out unscored competitors for ranking
        const scoredCompetitors = scores.filter(s => s.rawScore !== null);
        
        // Create a sorted copy for rank calculation without modifying original order
        const sortedForRanking = [...scoredCompetitors].sort((a, b) => (b.rawScore || 0) - (a.rawScore || 0));
        
        // First pass: assign ranks
        let currentRank = 1;
        let lastScore: number | null = null;
        
        const rankedScores = sortedForRanking.map((score, index) => {
            if (lastScore === null || score.rawScore !== lastScore) {
                currentRank = index + 1;
            }
            lastScore = score.rawScore;
            
            return {
                ...score,
                rank: currentRank
            };
        });

        // Second pass: identify ties
        const tiedGroups: { [key: number]: string[] } = {};
        const meaningfulTies: { [competitorId: string]: string[] } = {};

        rankedScores.forEach(score => {
            if (score.rawScore === null) return;
            if (!tiedGroups[score.rawScore]) {
                tiedGroups[score.rawScore] = [];
            }
            tiedGroups[score.rawScore].push(score.competitorId);
        });

        // Find ties and create tie breakers
        const tieBreakers: TieInfo[] = [];
        Object.entries(tiedGroups).forEach(([scoreStr, competitorIds]) => {
            if (competitorIds.length > 1) {
                const tiedScores = rankedScores.filter(s => competitorIds.includes(s.competitorId));
                const lowestRank = Math.min(...tiedScores.map(s => s.rank));
                const highestRank = lowestRank + competitorIds.length - 1;

                // For chief judge, all ties are meaningful
                // For regular judges, only ties affecting YES/ALT/NO boundaries are meaningful
                const isMeaningfulTie = judge.isChiefJudge || (
                    // Check if tie affects YES/ALT or ALT/NO boundaries or is between ALTs
                    (lowestRank <= competition.requiredYesCount && 
                     highestRank > competition.requiredYesCount) ||
                    (lowestRank <= (competition.requiredYesCount + competition.alternateCount) && 
                     highestRank > (competition.requiredYesCount + competition.alternateCount)) ||
                    (lowestRank > competition.requiredYesCount && 
                     highestRank <= (competition.requiredYesCount + competition.alternateCount))
                );

                if (isMeaningfulTie) {
                    // Store the meaningful tie information for each competitor in the tie
                    competitorIds.forEach(id => {
                        meaningfulTies[id] = competitorIds.filter(cId => cId !== id);
                    });

                    let tieType: TieInfo['type'];
                    let affectedPositions: string[];

                    if (judge.isChiefJudge) {
                        tieType = 'chief_judge';
                        affectedPositions = [`#${lowestRank}`, `#${highestRank}`];
                    } else if (lowestRank <= competition.requiredYesCount && 
                             highestRank > competition.requiredYesCount) {
                        tieType = 'yes_alt1';
                        affectedPositions = ['YES', 'ALT1'];
                    } else if (lowestRank <= (competition.requiredYesCount + competition.alternateCount) && 
                              highestRank > (competition.requiredYesCount + competition.alternateCount)) {
                        tieType = 'alt3_no';
                        affectedPositions = [`ALT${competition.alternateCount}`, 'NO'];
                    } else {
                        // Tie between alternates
                        const firstAltNum = lowestRank - competition.requiredYesCount;
                        const lastAltNum = highestRank - competition.requiredYesCount;
                        tieType = 'between_alts';
                        affectedPositions = [`ALT${firstAltNum}`, `ALT${lastAltNum}`];
                    }

                    tieBreakers.push({
                        competitorIds,
                        type: tieType,
                        affectedPositions
                    });
                }
            }
        });

        // Third pass: update scores with meaningful tie information only
        const updatedScores = rankedScores.map(score => ({
            ...score,
            tiedWith: meaningfulTies[score.competitorId] || []
        }));

        // Combine ranked scores with unscored competitors
        const unscoredCompetitors = scores.filter(s => s.rawScore === null).map(s => ({
            ...s,
            rank: 0,
            tiedWith: []
        }));

        // Return all scores in their original order
        const finalScores = scores.map(originalScore => {
            const updatedScore = updatedScores.find(s => s.competitorId === originalScore.competitorId);
            return updatedScore || {
                ...originalScore,
                rank: 0,
                tiedWith: []
            };
        });

        return [finalScores, tieBreakers];
    };

    const handleScoreChange = (competitorId: string, newScore: number) => {
        setState(prev => {
            // Get current role's scores
            const currentScores = prev.scoresByRole[prev.currentRole] || [];
            
            // Update the score for the changed competitor
            const newScores = currentScores.map(s =>
                s.competitorId === competitorId ? { ...s, rawScore: newScore } : s
            );
            
            // Calculate new ranks but maintain original order
            const [rankedScores, newTieBreakers] = calculateRanksAndTies(newScores);
            
            // Map ranked scores back to original order
            const updatedScores = newScores.map(score => {
                const rankedScore = rankedScores.find(r => r.competitorId === score.competitorId);
                return {
                    ...score,
                    rank: rankedScore?.rank || score.rank,
                    tiedWith: rankedScore?.tiedWith || []
                };
            });
            
            return {
                ...prev,
                scoresByRole: {
                    ...prev.scoresByRole,
                    [prev.currentRole]: updatedScores,
                },
                tieBreakers: newTieBreakers,
            };
        });
    };

    const getScoreColor = (score: CompetitorScore): string => {
        if (score.rawScore === null) return '#9e9e9e'; // grey for unscored
        const rank = score.rank || Infinity;
        if (rank <= competition.requiredYesCount) return '#4caf50'; // YES - green
        if (rank <= competition.requiredYesCount + competition.alternateCount) return '#2196f3'; // ALT - blue
        return '#f44336'; // NO - red
    };

    const getCompetitorStyle = (score: CompetitorScore) => {
        const rank = score.rank || 0;
        const isYes = rank <= competition.requiredYesCount;
        const isAlt = rank > competition.requiredYesCount && 
                     rank <= (competition.requiredYesCount + competition.alternateCount);
        const hasTie = score.tiedWith && score.tiedWith.length > 0;

        return {
            bgcolor: hasTie ? 'warning.light' : 
                    isYes ? 'success.light' :
                    isAlt ? 'info.light' :
                    'background.paper',
            border: 1,
            borderColor: hasTie ? 'warning.main' : 'divider',
            borderRadius: 1,
            p: 2,
            mb: 1,
        };
    };

    const getRankLabel = (score: CompetitorScore): string => {
        const rank = score.rank || 0;
        if (judge.isChiefJudge) {
            return `Rank: ${rank}`;
        }
        if (rank <= competition.requiredYesCount) {
            return 'YES';
        }
        if (rank <= competition.requiredYesCount + competition.alternateCount) {
            const altNum = rank - competition.requiredYesCount;
            return `ALT${altNum}`;
        }
        return 'NO';
    };

    const handleSubmit = async () => {
        const currentScores = state.scoresByRole[state.currentRole] || [];
        setState(prev => ({
            ...prev,
            scoresByRole: {
                ...prev.scoresByRole,
                [prev.currentRole]: currentScores
            }
        }));
        setConfirmDialogOpen(true);
    };

    const handleConfirmSubmit = async () => {
        try {
            if (judge.isChiefJudge) {
                // Submit a sheet for each role
                await Promise.all(judge.roles.map(async role => {
                    const sheet = {
                        competitionId: competition.id,
                        judgeId: judge.id,
                        role: role,
                        scores: state.scoresByRole[role] || [],
                        isSubmitted: true,
                        lastModified: Date.now(),
                    };
                    await db.saveJudgingSheet(sheet);
                }));
            } else {
                // Regular judge - submit only current role
                const sheet = {
                    competitionId: competition.id,
                    judgeId: judge.id,
                    role: state.currentRole,
                    scores: state.scoresByRole[state.currentRole] || [],
                    isSubmitted: true,
                    lastModified: Date.now(),
                };
                await db.saveJudgingSheet(sheet);
            }

            // Update judge status
            const updatedJudge = { ...judge, status: 'submitted' as JudgeStatus };
            const updatedCompetition = {
                ...competition,
                judges: competition.judges.map(j =>
                    j.id === judge.id ? updatedJudge : j
                ),
            };
            await db.saveCompetition(updatedCompetition);

            setState(prev => ({ ...prev, submitted: true }));
            setConfirmDialogOpen(false);
        } catch (err) {
            setError('Failed to submit scores');
            setConfirmDialogOpen(false);
        }
    };

    // Sort competitors by bib number for display
    const displayScores = [...(state.scoresByRole[state.currentRole] || [])].sort((a, b) => {
        const competitorA = competition.competitors[state.currentRole].find(c => c.id === a.competitorId);
        const competitorB = competition.competitors[state.currentRole].find(c => c.id === b.competitorId);
        return (competitorA?.bibNumber || 0) - (competitorB?.bibNumber || 0);
    });

    const canSubmit = useCallback(() => {
        if (!judge.isChiefJudge) {
            const currentScores = state.scoresByRole[state.currentRole] || [];
            return currentScores.every(score => score.rawScore !== null);
        }
        
        // For chief judges, check if all competitors in all roles are scored
        return judge.roles.every(role => {
            const roleScores = state.scoresByRole[role] || [];
            return roleScores.every(score => score.rawScore !== null);
        });
    }, [state.scoresByRole, state.currentRole, judge.roles, judge.isChiefJudge]);

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, p: 2 }}>
            <Typography variant="h4" gutterBottom>
                {competition.name}
            </Typography>
            <Typography variant="h5" color="text.secondary" gutterBottom>
                {judge.name} - {judge.isChiefJudge ? 'Chief Judge' : 'Judge'}
            </Typography>

            {judge.roles.length > 1 && (
                <Tabs
                    value={state.currentRole}
                    onChange={handleRoleChange}
                    sx={{ mb: 3 }}
                >
                    {judge.roles.map(role => (
                        <Tab key={role} label={`${role}s`} value={role} />
                    ))}
                </Tabs>
            )}

            <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Instructions
                </Typography>
                <Typography>
                    • Score each competitor from 0-100
                </Typography>
                {judge.isChiefJudge ? (
                    <>
                        <Typography>
                            • Ties will be highlighted in yellow
                        </Typography>
                        <Typography>
                            • Current rank is shown for each competitor
                        </Typography>
                    </>
                ) : (
                    <>
                        <Typography>
                            • Top {competition.requiredYesCount} will be marked as YES
                        </Typography>
                        <Typography>
                            • Next {competition.alternateCount} will be marked as alternates
                        </Typography>
                    </>
                )}
            </Paper>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Bib #</TableCell>
                            <TableCell>Score</TableCell>
                            <TableCell>Status {judge.isChiefJudge && '& Rank'}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {displayScores.map((score) => {
                            const competitor = competition.competitors[state.currentRole].find(
                                c => c.id === score.competitorId
                            );
                            if (!competitor) return null;

                            return (
                                <TableRow 
                                    key={score.competitorId}
                                    sx={{
                                        backgroundColor: score.tiedWith && score.tiedWith.length > 0 ? 'warning.light' : 'inherit'
                                    }}
                                >
                                    <TableCell>
                                        <Box>
                                            <Typography>#{competitor.bibNumber}</Typography>
                                            <Typography 
                                                variant="caption" 
                                                color="text.secondary"
                                                sx={{ display: 'block' }}
                                            >
                                                {competitor.name}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ width: '50%' }}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={9}>
                                                {score.rawScore === null ? (
                                                    <Box 
                                                        sx={{ 
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            height: '40px',
                                                            bgcolor: 'action.hover',
                                                            borderRadius: 1,
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleScoreChange(score.competitorId, 50)}
                                                    >
                                                        <Typography color="text.secondary">
                                                            Click to score
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    <Slider
                                                        value={score.rawScore}
                                                        onChange={(_, value) => handleScoreChange(score.competitorId, value as number)}
                                                        min={0}
                                                        max={100}
                                                        step={1}
                                                        disabled={state.submitted}
                                                        sx={{
                                                            '& .MuiSlider-thumb': {
                                                                bgcolor: getScoreColor(score),
                                                            },
                                                            '& .MuiSlider-track': {
                                                                bgcolor: getScoreColor(score),
                                                            },
                                                        }}
                                                    />
                                                )}
                                            </Grid>
                                            <Grid item xs={3}>
                                                <Typography 
                                                    variant="body1" 
                                                    sx={{ 
                                                        color: getScoreColor(score),
                                                        fontWeight: 'bold',
                                                        textAlign: 'right'
                                                    }}
                                                >
                                                    {score.rawScore === null ? '-' : score.rawScore}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {score.rawScore !== null && (
                                                    <>
                                                        {(score.rank || Infinity) <= competition.requiredYesCount && (
                                                            <Chip size="small" label="YES" color="success" />
                                                        )}
                                                        {(score.rank || Infinity) > competition.requiredYesCount && 
                                                         (score.rank || Infinity) <= (competition.requiredYesCount + competition.alternateCount) && (
                                                            <Chip 
                                                                size="small" 
                                                                label={`ALT${(score.rank || 0) - competition.requiredYesCount}`} 
                                                                color="info" 
                                                            />
                                                        )}
                                                        {(score.rank || Infinity) > (competition.requiredYesCount + competition.alternateCount) && (
                                                            <Chip size="small" label="NO" color="error" />
                                                        )}
                                                    </>
                                                )}
                                            </Box>
                                            {judge.isChiefJudge && score.rawScore !== null && (
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        fontWeight: 'bold',
                                                        minWidth: '2em',
                                                        textAlign: 'right'
                                                    }}
                                                >
                                                    #{score.rank || '-'}
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}

            <Box sx={{ mt: 3 }}>
                {!canSubmit() && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {judge.isChiefJudge 
                            ? 'Please score all competitors in all roles before submitting.'
                            : 'Please score all competitors before submitting.'}
                    </Alert>
                )}
                {state.tieBreakers.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {state.tieBreakers.length === 1 ? 'There is a tie' : 'There are ties'} that need
                        to be resolved{judge.isChiefJudge ? '' : ' by the chief judge'}.
                    </Alert>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained"
                        onClick={() => setConfirmDialogOpen(true)}
                        disabled={state.submitted || !canSubmit()}
                    >
                        Submit Scores
                    </Button>
                </Box>
            </Box>

            <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
                <DialogTitle>Confirm Score Submission</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to submit your scores? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmSubmit} variant="contained" color="primary">
                        Submit
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default JudgingSheet; 