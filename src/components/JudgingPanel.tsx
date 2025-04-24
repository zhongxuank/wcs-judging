import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    List,
    ListItem,
    IconButton,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Alert,
    Slide,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { Competition, Competitor, CompetitorRole, Judge } from '../types/competition';
import { JudgingState, CompetitorScore, JudgingSheet, TieInfo } from '../types/judging';
import { db } from '../services/db';
import { useNavigate, useBeforeUnload } from 'react-router-dom';

interface JudgingPanelProps {
    competition: Competition;
    judge: Judge;
    onScoreSubmit: (sheet: JudgingSheet) => void;
}

const JudgingPanel: React.FC<JudgingPanelProps> = ({
    competition,
    judge,
    onScoreSubmit,
}) => {
    const navigate = useNavigate();
    const [state, setState] = useState<JudgingState>({
        currentRole: judge.roles[0],
        judgingSheet: {
            competitionId: competition.id,
            judgeId: judge.id,
            role: judge.roles[0],
            scores: [],
            isSubmitted: false,
            lastModified: Date.now(),
        },
        tieBreakers: [],
        isDirty: false,
    });
    const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [swipeScore, setSwipeScore] = useState<number | null>(null);

    // Load existing scores if any
    useEffect(() => {
        const loadScores = async () => {
            try {
                const savedSheet = await db.getJudgingSheet(competition.id, judge.id, state.currentRole);
                if (savedSheet) {
                    setState(prev => ({
                        ...prev,
                        judgingSheet: savedSheet,
                    }));
                } else {
                    // Initialize empty scores for all competitors
                    const competitors = competition.competitors[state.currentRole];
                    setState(prev => ({
                        ...prev,
                        judgingSheet: {
                            ...prev.judgingSheet,
                            scores: competitors.map(c => ({
                                competitorId: c.id,
                                score: null,
                            })),
                        },
                    }));
                }
            } catch (err) {
                console.error('Error loading scores:', err);
            }
        };
        loadScores();
    }, [competition.id, judge.id, state.currentRole]);

    // Prevent accidental navigation
    useBeforeUnload(
        useCallback((e) => {
            if (state.isDirty) {
                e.preventDefault();
                return '';
            }
        }, [state.isDirty])
    );

    const handleRoleChange = (event: React.SyntheticEvent, newRole: CompetitorRole) => {
        if (state.isDirty) {
            setLeaveDialogOpen(true);
            return;
        }
        setState(prev => ({
            ...prev,
            currentRole: newRole,
            judgingSheet: {
                ...prev.judgingSheet,
                role: newRole,
            },
        }));
    };

    const handleTouchStart = (e: React.TouchEvent, competitorId: string) => {
        setTouchStart(e.touches[0].clientX);
        // Get current score or 0 if not yet scored
        const currentScore = state.judgingSheet.scores.find(s => s.competitorId === competitorId)?.score ?? 0;
        setSwipeScore(currentScore);
    };

    const handleTouchMove = (e: React.TouchEvent, competitorId: string) => {
        if (touchStart === null || swipeScore === null) return;

        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStart;
        
        // Convert swipe distance to score change (1 point per 50px)
        const scoreChange = Math.floor(diff / 50);
        const newScore = Math.max(0, Math.min(10, swipeScore + scoreChange));
        
        updateScore(competitorId, newScore);
    };

    const handleTouchEnd = () => {
        setTouchStart(null);
        setSwipeScore(null);
    };

    const handleMicroAdjust = (competitorId: string, delta: number) => {
        const currentScore = state.judgingSheet.scores.find(s => s.competitorId === competitorId)?.score ?? 0;
        const newScore = Math.max(0, Math.min(10, currentScore + delta));
        updateScore(competitorId, newScore);
    };

    const updateScore = (competitorId: string, newScore: number) => {
        setState(prev => {
            const newScores = prev.judgingSheet.scores.map(s => 
                s.competitorId === competitorId ? { ...s, score: newScore } : s
            );
            
            // Calculate results and ties
            const { updatedScores, tieBreakers } = calculateResults(newScores);

            return {
                ...prev,
                judgingSheet: {
                    ...prev.judgingSheet,
                    scores: updatedScores,
                    lastModified: Date.now(),
                },
                tieBreakers,
                isDirty: true,
            };
        });
    };

    const calculateResults = (scores: CompetitorScore[]): { 
        updatedScores: CompetitorScore[], 
        tieBreakers: TieInfo[] 
    } => {
        // Sort scores by value (descending)
        const sortedScores = [...scores]
            .filter(s => s.score !== null)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        const yesCount = competition.requiredYesCount;
        const altCount = competition.alternateCount;
        const updatedScores = [...scores];
        const tieBreakers: TieInfo[] = [];

        if (judge.isChiefJudge) {
            // For chief judge, calculate ranks and find all ties
            sortedScores.forEach((score, index) => {
                const rank = index + 1;
                const sameScore = sortedScores.filter(s => s.score === score.score);
                if (sameScore.length > 1) {
                    tieBreakers.push({
                        competitorIds: sameScore.map(s => s.competitorId),
                        type: 'chief_judge',
                        affectedPositions: [`Rank ${rank}`],
                    });
                }
                const scoreIndex = updatedScores.findIndex(s => s.competitorId === score.competitorId);
                updatedScores[scoreIndex] = {
                    ...updatedScores[scoreIndex],
                    rank,
                    tiedWith: sameScore.length > 1 ? sameScore.map(s => s.competitorId) : undefined,
                };
            });
        } else {
            // For regular judges, assign YES/NO/ALT based on scores
            sortedScores.forEach((score, index) => {
                const scoreIndex = updatedScores.findIndex(s => s.competitorId === score.competitorId);
                let result: ResultType = 'NO';

                if (index < yesCount) {
                    result = 'YES';
                } else if (index < yesCount + altCount) {
                    result = `ALT${index - yesCount + 1}` as ResultType;
                }

                updatedScores[scoreIndex] = {
                    ...updatedScores[scoreIndex],
                    calculatedResult: result,
                };

                // Check for significant ties
                const nextScore = sortedScores[index + 1];
                if (nextScore && score.score === nextScore.score) {
                    let type: TieInfo['type'];
                    let positions: string[];

                    if (index === yesCount - 1) {
                        type = 'yes_alt1';
                        positions = ['YES', 'ALT1'];
                    } else if (index >= yesCount && index < yesCount + altCount - 1) {
                        type = 'between_alts';
                        positions = [`ALT${index - yesCount + 1}`, `ALT${index - yesCount + 2}`];
                    } else if (index === yesCount + altCount - 1) {
                        type = 'alt3_no';
                        positions = ['ALT3', 'NO'];
                    }

                    if (type && positions) {
                        tieBreakers.push({
                            competitorIds: [score.competitorId, nextScore.competitorId],
                            type,
                            affectedPositions: positions,
                        });
                    }
                }
            });
        }

        return { updatedScores, tieBreakers };
    };

    const handleSubmit = async () => {
        try {
            await db.saveJudgingSheet(state.judgingSheet);
            onScoreSubmit(state.judgingSheet);
            setState(prev => ({
                ...prev,
                isDirty: false,
            }));
        } catch (err) {
            console.error('Error saving scores:', err);
        }
    };

    const renderCompetitor = (competitor: Competitor) => {
        const score = state.judgingSheet.scores.find(s => s.competitorId === competitor.id);
        const hasScore = score?.score !== null;
        const result = score?.calculatedResult;
        const rank = score?.rank;
        const isTied = score?.tiedWith && score.tiedWith.length > 0;

        return (
            <ListItem
                key={competitor.id}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    py: 2,
                    bgcolor: isTied ? 'warning.light' : 
                             result === 'YES' ? 'success.light' :
                             result?.startsWith('ALT') ? 'info.light' : 
                             'background.paper',
                    '&:hover': {
                        bgcolor: 'action.hover',
                    },
                }}
                onTouchStart={(e) => handleTouchStart(e, competitor.id)}
                onTouchMove={(e) => handleTouchMove(e, competitor.id)}
                onTouchEnd={handleTouchEnd}
            >
                <Box sx={{ minWidth: 80 }}>
                    <Typography variant="h6">
                        #{competitor.bibNumber}
                    </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        {competitor.name}
                    </Typography>
                    {hasScore && (
                        <Typography variant="body1">
                            Score: {score.score?.toFixed(1)}
                            {rank && ` (Rank: ${rank})`}
                            {result && ` - ${result}`}
                        </Typography>
                    )}
                </Box>
                {hasScore && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                            size="small"
                            onClick={() => handleMicroAdjust(competitor.id, -0.1)}
                        >
                            <RemoveIcon />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => handleMicroAdjust(competitor.id, 0.1)}
                        >
                            <AddIcon />
                        </IconButton>
                    </Box>
                )}
            </ListItem>
        );
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {judge.roles.length > 1 && (
                <Tabs
                    value={state.currentRole}
                    onChange={handleRoleChange}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    {judge.roles.map(role => (
                        <Tab key={role} label={role} value={role} />
                    ))}
                </Tabs>
            )}

            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {state.tieBreakers.length > 0 && (
                    <Alert severity="warning" sx={{ m: 2 }}>
                        {state.tieBreakers.map((tie, index) => (
                            <Typography key={index}>
                                Tie detected for position(s): {tie.affectedPositions.join(' vs ')}
                            </Typography>
                        ))}
                    </Alert>
                )}

                <List sx={{ pb: 8 }}>
                    {competition.competitors[state.currentRole].map(renderCompetitor)}
                </List>
            </Box>

            <Paper 
                elevation={3} 
                sx={{ 
                    position: 'fixed', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                }}
            >
                <Typography variant="body2" color="text.secondary">
                    {state.judgingSheet.isSubmitted ? 'Submitted' : 'Draft'}
                    {state.isDirty && ' • Unsaved changes'}
                </Typography>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!state.isDirty}
                >
                    {state.judgingSheet.isSubmitted ? 'Update Scores' : 'Submit Scores'}
                </Button>
            </Paper>

            <Dialog
                open={leaveDialogOpen}
                onClose={() => setLeaveDialogOpen(false)}
            >
                <DialogTitle>Unsaved Changes</DialogTitle>
                <DialogContent>
                    <Typography>
                        You have unsaved changes. Do you want to save before leaving?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={async () => {
                            await handleSubmit();
                            setLeaveDialogOpen(false);
                        }}
                        variant="contained"
                    >
                        Save and Continue
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
            >
                <DialogTitle>Warning: Editing Submitted Scores</DialogTitle>
                <DialogContent>
                    <Typography>
                        Editing these scores will affect the final results. Are you sure you want to continue?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={() => {
                            setState(prev => ({
                                ...prev,
                                judgingSheet: {
                                    ...prev.judgingSheet,
                                    isSubmitted: false,
                                },
                                isDirty: true,
                            }));
                            setEditDialogOpen(false);
                        }}
                        color="error"
                        variant="contained"
                    >
                        Edit Scores
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default JudgingPanel; 