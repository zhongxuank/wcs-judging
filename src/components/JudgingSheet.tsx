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
    Card,
    CardContent,
} from '@mui/material';
import { Competition, Judge, CompetitorRole, JudgeStatus, JudgingSheet as CompetitionJudgingSheet, Score, Competitor } from '../types/competition';
import { db } from '../services/db';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useNavigate } from 'react-router-dom';

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

interface CompetitorsByHeat {
    [key: number]: {
        [key in CompetitorRole]: Array<{
            id: string;
            name: string;
            bibNumber: number;
            isRepeat?: boolean;
            originalHeat?: number;
        }>;
    };
}

// Helper function to create a new score object with updated rank/tie info
const updateScoreDetails = (score: Score, rank?: number, hasTie?: boolean, status?: 'YES' | 'ALT' | 'NO', tiedWith?: string[]): Score => ({
    ...score,
    rank: rank,
    hasTie: hasTie || false,
    status: status,
    tiedWith: tiedWith || [],
});

interface ScoreCardProps {
    competitor: Competitor;
    score: Score;
    onScoreChange: (competitorId: string, newScore: number) => void;
    statusColor: string;
}

const JudgingSheet: React.FC<JudgingSheetProps> = ({ competition, judge, onSubmit }) => {
    const navigate = useNavigate();
    console.log('Judge roles:', judge.roles);
    
    // Ensure we have at least one role
    if (!judge.roles || judge.roles.length === 0) {
        console.error('Judge has no roles assigned:', judge);
        throw new Error('Judge must have at least one role assigned');
    }

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
    const [activeRow, setActiveRow] = useState<string | null>(null);
    const [isScoring, setIsScoring] = useState(false);
    const [dragStarted, setDragStarted] = useState(false);

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

    useEffect(() => {
        // Initialize scores for current role
        if (!state.currentRole) {
            console.error('No current role set');
            return;
        }

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

        // Load any existing scores from the database
        const loadExistingScores = async () => {
            try {
                const existingSheet = await db.getJudgingSheet(
                    competition.id,
                    judge.id,
                    state.currentRole
                );
                
                if (existingSheet) {
                    setState(prev => ({ 
                        ...prev, 
                        scores: existingSheet.scores,
                        submitted: existingSheet.submitted,
                        sortedScores: calculateRanksAndTies(existingSheet.scores)
                    }));
                } else {
                    setState(prev => ({ ...prev, scores: initialScores, sortedScores: null }));
                }
            } catch (error) {
                console.error('Error loading existing scores:', error);
                setState(prev => ({ ...prev, scores: initialScores, sortedScores: null }));
            }
        };

        loadExistingScores();
    }, [competition, state.currentRole, judge.id, calculateRanksAndTies]);

    // Auto-save scores periodically
    useEffect(() => {
        if (!state.currentRole) {
            console.error('No current role set for auto-save');
            return;
        }

        const autoSaveScores = async () => {
            // Clean up scores to ensure no undefined values
            const cleanScores = state.scores.map(score => ({
                bibNumber: score.bibNumber,
                competitorId: score.competitorId,
                rawScore: score.rawScore,
                rank: score.rank === undefined ? undefined : score.rank,  // Keep undefined if it's undefined
                hasTie: score.hasTie || false,
                status: score.status === undefined ? undefined : score.status,  // Keep undefined if it's undefined
                tiedWith: score.tiedWith || []
            }));

            const sheetId = `${competition.id}_${judge.id}_${state.currentRole.toLowerCase()}`;
            const judgingSheet: JudgingSheetType = {
                id: sheetId,
                competitionId: competition.id,
                judgeId: judge.id,
                role: state.currentRole.toLowerCase() as 'leader' | 'follower',
                scores: cleanScores,
                submitted: state.submitted,
                lastUpdated: Date.now()
            };

            try {
                await db.saveJudgingSheet(judgingSheet);
            } catch (error) {
                console.error('Error auto-saving scores:', error);
            }
        };

        // Save whenever scores change, but debounce to avoid too frequent saves
        const timeoutId = setTimeout(autoSaveScores, 2000);
        return () => clearTimeout(timeoutId);
    }, [state.scores, competition.id, judge.id, state.currentRole, state.submitted]);

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
        if (!score.status) return 'rgba(0, 0, 0, 0.1)';
        switch (score.status) {
            case 'YES': return 'rgba(76, 175, 80, 0.7)'; // Green for YES
            case 'ALT': return 'rgba(255, 152, 0, 0.7)'; // Orange for ALT
            case 'NO': return 'rgba(244, 67, 54, 0.7)';  // Red for NO
            default: return 'rgba(0, 0, 0, 0.1)';
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
            submitted: true,
            lastUpdated: Date.now()
        };

        try {
            await db.saveJudgingSheet(judgingSheet);
            onSubmit();
            navigate('/'); // Navigate to home page after successful submission
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

    const handleTouchStart = (e: React.TouchEvent, competitorId: string) => {
        const touch = e.touches[0];
        setTouchStart({ x: touch.clientX, y: touch.clientY });
        setActiveRow(competitorId);
        setIsScoring(false);
        setDragStarted(false);
    };

    const handleTouchMove = (e: React.TouchEvent, competitorId: string) => {
        if (!touchStart) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;
        if (!isScoring && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
            if (Math.abs(deltaX) > Math.abs(deltaY) * 0.577) {
                setIsScoring(true);
                setDragStarted(true);
                e.preventDefault();
            } else {
                setActiveRow(null);
                setIsScoring(false);
                setDragStarted(false);
                return;
            }
        }
        if (isScoring) {
            const target = e.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const score = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
            setTouchScore(score);
            handleScoreChange(competitorId, score);
        }
    };

    const handleTouchEnd = () => {
        setTouchStart(null);
        setTouchScore(null);
        setActiveRow(null);
        setIsScoring(false);
        setDragStarted(false);
    };

    // Mouse support for desktop
    const handleMouseDown = (e: React.MouseEvent, competitorId: string) => {
        setTouchStart({ x: e.clientX, y: e.clientY });
        setActiveRow(competitorId);
        setIsScoring(false);
        setDragStarted(false);
    };

    const handleMouseMove = (e: React.MouseEvent, competitorId: string) => {
        if (!touchStart) return;
        const deltaX = e.clientX - touchStart.x;
        const deltaY = e.clientY - touchStart.y;
        if (!isScoring && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
            if (Math.abs(deltaX) > Math.abs(deltaY) * 0.577) {
                setIsScoring(true);
                setDragStarted(true);
            } else {
                setActiveRow(null);
                setIsScoring(false);
                setDragStarted(false);
                return;
            }
        }
        if (isScoring) {
            const target = e.currentTarget as HTMLElement;
            const rect = target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const score = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
            setTouchScore(score);
            handleScoreChange(competitorId, score);
        }
    };

    const handleMouseUp = () => {
        setTouchStart(null);
        setTouchScore(null);
        setActiveRow(null);
        setIsScoring(false);
        setDragStarted(false);
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

    // Add this function to create an empty score
    const createEmptyScore = (competitorId: string, bibNumber: number): Score => ({
        competitorId,
        bibNumber: bibNumber.toString(),
        rawScore: null,
        rank: undefined,
        hasTie: false,
        tiedWith: []
    });

    // Add this function to organize competitors by heat
    const organizeCompetitorsByHeat = useCallback(() => {
        const competitorsByHeat: CompetitorsByHeat = {};
        
        // Get heats data from competition
        const heats = competition.heats || [];
        
        heats.forEach((heat) => {
            competitorsByHeat[heat.number] = {
                Leader: heat.competitors.Leader.filter((c: Competitor) => !c.isRepeat),
                Follower: heat.competitors.Follower.filter((c: Competitor) => !c.isRepeat)
            };
        });
        
        return competitorsByHeat;
    }, [competition]);

    // Modify the display logic based on whether it's a chief judge
    const renderCompetitorList = () => {
        const heats = competition.heats || [];
        const scores = state.scores;
        const renderedCompetitors = new Set<string>();
        const isMultiRole = judge.isChiefJudge || judge.roles.length > 1;
        const rolesToShow: CompetitorRole[] = isMultiRole ? ['Leader', 'Follower'] : [state.currentRole];

        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                {heats.map((heat) => (
                    <React.Fragment key={heat.number}>
                        {rolesToShow.map((role) => {
                            // Filter out repeats and already-rendered competitors
                            const competitors: Competitor[] = (heat.competitors[role] || []).filter(
                                (c: Competitor) => !c.isRepeat && !renderedCompetitors.has(c.id)
                            );
                            if (competitors.length === 0) return null;
                            // Mark these competitors as rendered
                            competitors.forEach((c: Competitor) => renderedCompetitors.add(c.id));
                            return (
                                <Box key={role + heat.number}>
                                    <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
                                        Heat {heat.number} {role === 'Leader' ? 'Leaders' : 'Followers'}
                                    </Typography>
                                    {competitors.map((competitor: Competitor) => {
                                        const score = scores.find(s => s.competitorId === competitor.id) || createEmptyScore(competitor.id, competitor.bibNumber);
                                        return (
                                            <ScoreCard
                                                key={competitor.id}
                                                competitor={competitor}
                                                score={score}
                                                onScoreChange={handleScoreChange}
                                                statusColor={getScoreColor(score)}
                                            />
                                        );
                                    })}
                                </Box>
                            );
                        })}
                    </React.Fragment>
                ))}
            </Box>
        );
    };

    // ScoreCard component for each competitor
    const ScoreCard: React.FC<ScoreCardProps> = ({ competitor, score, onScoreChange, statusColor }) => {
        const [dragging, setDragging] = useState(false);
        const [dragScore, setDragScore] = useState<number | null>(null);
        const cardRef = React.useRef<HTMLDivElement | null>(null);

        // Helper to get score from x position
        const getScoreFromX = (clientX: number, increments: number) => {
            if (!cardRef.current) return 0;
            const rect = cardRef.current.getBoundingClientRect();
            const x = clientX - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));
            let score = Math.round(percent * 100);
            if (increments > 1) score = Math.round(score / increments) * increments;
            return score;
        };

        // Tap/click handler (increments of 10)
        const handleTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
            if (dragging) return;
            let clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const newScore = getScoreFromX(clientX, 10);
            setDragScore(null);
            onScoreChange(competitor.id, newScore);
        };

        // Drag handlers (increments of 1)
        const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
            setDragging(true);
            let clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            setDragScore(getScoreFromX(clientX, 1));
            e.preventDefault();
        };
        const handleDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
            if (!dragging) return;
            let clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            setDragScore(getScoreFromX(clientX, 1));
            e.preventDefault();
        };
        const handleDragEnd = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
            if (!dragging) return;
            let clientX: number;
            if ('changedTouches' in e && e.changedTouches.length > 0) {
                clientX = e.changedTouches[0].clientX;
            } else if ('touches' in e && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
            } else {
                // Mouse event
                clientX = (e as React.MouseEvent<HTMLDivElement>).clientX;
            }
            const finalScore = getScoreFromX(clientX, 1);
            setDragging(false);
            setDragScore(null);
            onScoreChange(competitor.id, finalScore);
            e.preventDefault();
        };

        // Show dragScore live if dragging, else show score
        const displayScore = dragging && dragScore !== null ? dragScore : (score.rawScore ?? '-');
        // Bar color: only update on drag end (not live)
        const barColor = dragging ? 'rgba(0,0,0,0.15)' : statusColor;
        const barWidth = ((dragging && dragScore !== null ? dragScore : score.rawScore) || 0) + '%';

        return (
            <Card
                ref={cardRef}
                sx={{
                    position: 'relative',
                    minHeight: 80,
                    borderRadius: 3,
                    boxShadow: dragging ? 6 : 1,
                    overflow: 'hidden',
                    touchAction: 'pan-y',
                    userSelect: 'none',
                }}
                onClick={handleTap}
                onTouchStart={handleDragStart}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
                onMouseDown={handleDragStart}
                onMouseMove={dragging ? handleDragMove : undefined}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: barWidth,
                        background: barColor,
                        transition: dragging ? 'none' : 'width 0.2s, background 0.2s',
                        zIndex: 0,
                    }}
                />
                <CardContent sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', height: 80 }}>
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>#{competitor.bibNumber}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>{competitor.name}</Typography>
                    </Box>
                    <Box sx={{ minWidth: 80, textAlign: 'center' }}>
                        <Typography variant="h3" sx={{ fontWeight: 'bold', color: dragging ? 'primary.main' : (score.status === 'NO' ? 'white' : 'text.primary') }}>
                            {displayScore}
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, p: 2 }}>
            <Typography variant="h4" gutterBottom>
                {competition.name}
            </Typography>
            <Typography variant="h5" color="text.secondary" gutterBottom>
                {judge.name} - {judge.isChiefJudge ? 'Chief Judge' : 'Judge'}
            </Typography>

            {/* Only show role tabs for regular judges with multiple roles */}
            {!judge.isChiefJudge && judge.roles.length > 1 && (
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

            {renderCompetitorList()}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!canSubmit()}
                >
                    Submit Scores
                </Button>
            </Box>

            <Dialog
                open={confirmDialogOpen}
                onClose={() => setConfirmDialogOpen(false)}
            >
                <DialogTitle>Confirm Score Submission</DialogTitle>
                <DialogContent>
                    Are you sure you want to submit your scores? This action cannot be undone.
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmSubmit} variant="contained">
                        Submit
                    </Button>
                </DialogActions>
            </Dialog>

            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );
};

export default JudgingSheet; 