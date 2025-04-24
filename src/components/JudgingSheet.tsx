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
    IconButton,
    TextField,
} from '@mui/material';
import { Competition, Judge, CompetitorRole, JudgeStatus, JudgingSheet as CompetitionJudgingSheet, Score } from '../types/competition';
import { db } from '../services/db';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

type JudgingSheetType = CompetitionJudgingSheet;

interface JudgingSheetProps {
    competition: Competition;
    judge: Judge;
    onSubmit: () => void;
}

interface JudgingState {
    scores: Score[];
    sortedScores: Score[] | null;
    submitted: boolean;
    currentRole: CompetitorRole;
}

interface TieInfo {
    competitorIds: string[];
    type: 'yes_alt1' | 'between_alts' | 'alt3_no' | 'chief_judge';
    affectedPositions: string[];
}

// Helper function to create a new score object with updated rank/tie info
const updateScoreDetails = (score: Score, rank?: number, hasTie?: boolean, status?: 'YES' | 'ALT' | 'NO', tiedWith?: string[]): Score => ({
    ...score,
    rank: rank,
    hasTie: hasTie || false,
    status: status,
    tiedWith: tiedWith || [],
});

const JudgingSheet: React.FC<JudgingSheetProps> = ({ competition, judge, onSubmit }) => {
    const [state, setState] = useState<JudgingState>({
        scores: [],
        sortedScores: null,
        submitted: false,
        currentRole: judge.roles[0]
    });

    const [error, setError] = useState<string | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchScore, setTouchScore] = useState<number | null>(null);
    const [isAdjusting, setIsAdjusting] = useState(false);

    useEffect(() => {
        // Initialize scores for current role
        const competitors = competition.competitors[state.currentRole] || [];
        const initialScores: Score[] = competitors.map(competitor => ({
            bibNumber: competitor.bibNumber.toString(),
            competitorId: competitor.id,
            rawScore: null,
            rank: undefined,
            hasTie: false,
            status: undefined,
            tiedWith: []
        }));
        setState(prev => ({ ...prev, scores: initialScores, sortedScores: null })); // Reset sortedScores on role change
    }, [competition, state.currentRole]);

    const calculateRanksAndTies = useCallback((scoresToProcess: Score[]): Score[] => {
        // Create a deep copy to avoid mutating the original state scores directly
        let workingScores = JSON.parse(JSON.stringify(scoresToProcess)) as Score[];
        
        // Reset tie status before recalculating on the copy
        workingScores.forEach(score => {
            score.hasTie = false;
            score.tiedWith = [];
        });

        // Sort the copied scores from highest to lowest
        workingScores.sort((a, b) => {
            const scoreA = a.rawScore ?? -Infinity;
            const scoreB = b.rawScore ?? -Infinity;
            return scoreB - scoreA;
        });

        let currentRank = 1;
        let lastScore = workingScores[0]?.rawScore ?? null;

        // First pass: assign ranks on the copy
        workingScores.forEach((score, index) => {
            if (score.rawScore === null) {
                score.rank = undefined;
                return;
            }
            if (score.rawScore !== lastScore) {
                currentRank = index + 1;
                lastScore = score.rawScore;
            }
            score.rank = currentRank;
        });

        // Second pass: identify ties on the copy
        for (let i = 0; i < workingScores.length; i++) {
            if (workingScores[i].rawScore === null) continue;
            
            let tiedGroupIndices = [i];
            for (let j = i + 1; j < workingScores.length; j++) {
                if (workingScores[j].rawScore === workingScores[i].rawScore) {
                    tiedGroupIndices.push(j);
                } else {
                    break; // Scores are sorted, so no more ties for this score
                }
            }

            if (tiedGroupIndices.length > 1) {
                const tiedCompetitorIds = tiedGroupIndices.map(idx => workingScores[idx].competitorId);
                tiedGroupIndices.forEach(idx => {
                    workingScores[idx].hasTie = true;
                    workingScores[idx].tiedWith = tiedCompetitorIds.filter(id => id !== workingScores[idx].competitorId);
                });
                i += tiedGroupIndices.length - 1; // Skip the rest of the tied group
            }
        }

        // Third pass: update status based on rank on the copy
        workingScores.forEach(score => {
            if (score.rank === undefined) {
                score.status = undefined;
                return;
            }
            if (score.rank <= competition.requiredYesCount) {
                score.status = 'YES';
            } else if (score.rank <= (competition.requiredYesCount + competition.alternateCount)) {
                score.status = 'ALT';
            } else {
                score.status = 'NO';
            }
        });

        // Return the processed copy
        return workingScores;

    }, [competition.requiredYesCount, competition.alternateCount]);

    const debouncedCalculateRanks = useCallback((latestScores: Score[]) => {
        setTimeout(() => {
            const calculatedSortedScores = calculateRanksAndTies(latestScores);
            
            // Create a map for quick lookup of calculated details
            const calculatedDetailsMap = new Map<string, Partial<Score>>();
            calculatedSortedScores.forEach(s => {
                calculatedDetailsMap.set(s.competitorId, {
                    rank: s.rank,
                    hasTie: s.hasTie,
                    status: s.status,
                    tiedWith: s.tiedWith
                });
            });

            setState(prev => {
                // Update the main scores array with the latest calculated details
                const updatedMainScores = prev.scores.map(score => {
                    const details = calculatedDetailsMap.get(score.competitorId);
                    return details ? { ...score, ...details } : score;
                });
                
                return {
                     ...prev,
                      scores: updatedMainScores,
                      sortedScores: calculatedSortedScores
                };
            });
        }, 5); // Reduced from 50ms to 5ms for more responsive updates
    }, [calculateRanksAndTies]);

    const handleRoleChange = (_: React.SyntheticEvent, newRole: CompetitorRole) => {
        setState(prev => ({
            ...prev,
            currentRole: newRole,
        }));
    };

    const handleScoreChange = (competitorId: string, newScore: number | null) => {
        setState(prev => {
            const updatedScores = prev.scores.map(score => 
                score.competitorId === competitorId 
                    ? { ...score, rawScore: newScore }
                    : score
            );
            debouncedCalculateRanks(updatedScores);
            return { ...prev, scores: updatedScores };
        });
    };

    const getScoreColor = (score: Score): string => {
        if (!score.status) return '';
        switch (score.status) {
            case 'YES': return 'rgba(76, 175, 80, 0.1)';
            case 'ALT': return 'rgba(255, 152, 0, 0.1)';
            case 'NO': return 'rgba(244, 67, 54, 0.1)';
            default: return '';
        }
    };

    const getCompetitorStyle = (score: Score) => {
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

    const getRankLabel = (score: Score): string => {
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
        const finalScores = state.sortedScores || calculateRanksAndTies(state.scores);
        setState(prev => ({
            ...prev,
            scores: finalScores,
            sortedScores: finalScores,
            submitted: true
        }));
        setConfirmDialogOpen(true);
    };

    const handleConfirmSubmit = async () => {
        const sheetId = `${competition.id}_${judge.id}_${state.currentRole.toLowerCase()}`;
        const judgingSheet: JudgingSheetType = {
            id: sheetId,
            competitionId: competition.id,
            judgeId: judge.id,
            role: state.currentRole.toLowerCase() as 'leader' | 'follower',
            scores: state.scores,
            submitted: true
        };

        try {
            await db.saveJudgingSheet(judgingSheet);
            onSubmit();
        } catch (error) {
            console.error('Error saving judging sheet:', error);
            setError('Failed to save scores. Please try again.');
        }
    };

    // Sort competitors by bib number for display
    const displayScores = [...state.scores].sort((a, b) => {
        const competitorA = competition.competitors[state.currentRole].find(c => c.id === a.competitorId);
        const competitorB = competition.competitors[state.currentRole].find(c => c.id === b.competitorId);
        return (competitorA?.bibNumber || 0) - (competitorB?.bibNumber || 0);
    });

    const canSubmit = useCallback(() => {
        if (!judge.isChiefJudge) {
            const currentScores = state.scores;
            return currentScores.every(score => score.rawScore !== null);
        }
        
        // For chief judges, check if all competitors in all roles are scored
        return judge.roles.every(role => {
            const roleScores = state.scores.filter(s => s.competitorId.startsWith(role));
            return roleScores.every(score => score.rawScore !== null);
        });
    }, [state.scores, judge.roles, judge.isChiefJudge]);

    const handleTouchStart = (e: React.TouchEvent, competitorId: string, currentScore: number | null) => {
        const touch = e.touches[0];
        const element = e.currentTarget as HTMLElement;
        const rect = element.getBoundingClientRect();
        
        // Calculate initial score based on touch position
        const touchX = touch.clientX - rect.left;
        const initialScore = Math.max(0, Math.min(100, Math.round((touchX / rect.width) * 100)));
        
        setTouchStart({
            x: touch.clientX,
            y: touch.clientY
        });
        setTouchScore(currentScore ?? initialScore);
        setIsAdjusting(true);

        // If starting from null, immediately set the initial score
        if (currentScore === null) {
            handleScoreChange(competitorId, initialScore);
        }
    };

    const handleTouchMove = (e: React.TouchEvent, competitorId: string) => {
        if (!touchStart || !isAdjusting) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        
        // Make the scoring less sensitive - 15 pixels per point
        const sensitivity = 15; // pixels per point
        const scoreDelta = Math.round(deltaX / sensitivity);
        
        const baseScore = touchScore ?? 0;
        const newScore = Math.max(0, Math.min(100, baseScore + scoreDelta));
        
        // Update score immediately without debouncing
        handleScoreChange(competitorId, newScore);
    };

    const handleTouchEnd = () => {
        setTouchStart(null);
        setTouchScore(null);
        setIsAdjusting(false);
    };

    const handleScoreAdjust = (competitorId: string, currentScore: number | null, delta: number) => {
        const baseScore = currentScore ?? 50;
        const newScore = Math.max(0, Math.min(100, baseScore + delta));
        handleScoreChange(competitorId, newScore);
    };

    const handleDirectInput = (competitorId: string, value: string) => {
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
            handleScoreChange(competitorId, numValue);
        }
    };

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
                    • Slide horizontally along any row to set a score (0-100)
                </Typography>
                <Typography>
                    • Left side = 0, Right side = 100
                </Typography>
                <Typography>
                    • Use +/- buttons for fine adjustments
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
                                        backgroundColor: score.hasTie ? 'warning.light' : 'inherit',
                                        transition: 'background-color 0.2s',
                                        position: 'relative', 
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
                                    <TableCell sx={{ width: '50%', position: 'relative', cursor: 'pointer', touchAction: 'pan-y' }}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid item xs={12}>
                                                {score.rawScore === null ? (
                                                    <Box 
                                                        sx={{ 
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            height: '60px',
                                                            bgcolor: 'action.hover',
                                                            borderRadius: 1,
                                                            cursor: 'pointer',
                                                            touchAction: 'pan-y'
                                                        }}
                                                        onTouchStart={(e) => handleTouchStart(e, score.competitorId, null)}
                                                        onTouchMove={(e) => handleTouchMove(e, score.competitorId)}
                                                        onTouchEnd={handleTouchEnd}
                                                    >
                                                        <Typography color="text.secondary">
                                                            Slide to start scoring
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 1,
                                                            position: 'relative',
                                                        }}
                                                    >
                                                        <IconButton 
                                                            onClick={() => handleScoreAdjust(score.competitorId, score.rawScore, -0.1)}
                                                            sx={{ p: 1 }}
                                                            disabled={score.rawScore === null || score.rawScore <= 0}
                                                        >
                                                            <RemoveIcon />
                                                        </IconButton>
                                                        
                                                        <Box
                                                            sx={{
                                                                flex: 1,
                                                                height: '4px',
                                                                bgcolor: 'action.hover',
                                                                borderRadius: '2px',
                                                                position: 'relative'
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    position: 'absolute',
                                                                    left: 0,
                                                                    width: `${score.rawScore}%`,
                                                                    height: '100%',
                                                                    bgcolor: getScoreColor(score) || 'primary.main',
                                                                    borderRadius: '2px'
                                                                }}
                                                            />
                                                        </Box>
                                                        
                                                        <Typography
                                                            sx={{
                                                                minWidth: '3em',
                                                                textAlign: 'center',
                                                                fontWeight: 'bold'
                                                            }}
                                                        >
                                                            {score.rawScore !== null ? score.rawScore.toFixed(1) : '-'}
                                                        </Typography>
                                                        
                                                        <IconButton 
                                                            onClick={() => handleScoreAdjust(score.competitorId, score.rawScore, 0.1)}
                                                            sx={{ p: 1 }}
                                                            disabled={score.rawScore === null || score.rawScore >= 100}
                                                        >
                                                            <AddIcon />
                                                        </IconButton>
                                                    </Box>
                                                )}
                                            </Grid>
                                        </Grid>
                                        {/* Visual Score Bar */}                                    
                                        {score.rawScore !== null && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    left: '5%', // Align with the central scoring area roughly
                                                    right: '5%',
                                                    height: '4px',
                                                    bgcolor: 'action.disabledBackground',
                                                    borderRadius: '2px',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        height: '100%',
                                                        width: `${score.rawScore}%`,
                                                        bgcolor: getScoreColor(score) || 'primary.main',
                                                        borderRadius: '2px',
                                                        transition: 'width 0.1s ease-out',
                                                    }}
                                                />
                                            </Box>
                                        )}
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
                {state.scores.length > 0 && state.scores.length < competition.competitors[state.currentRole].length && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {state.scores.length === 1 ? 'There is a competitor missing' : 'There are competitors missing'}
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