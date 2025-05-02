import React, { useEffect, useState } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Tabs,
    Tab,
    Chip,
} from '@mui/material';
import { Competition, CompetitorRole, Judge } from '../types/competition';
import { JudgingSheet } from '../types/judging';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';

interface CompetitionStatusProps {
    competition: Competition;
}

interface CompetitorResults {
    id: string;
    bibNumber: number;
    name: string;
    chiefJudgeRank: number | null;
    regularJudgeScores: {
        [judgeId: string]: {
            rawScore: number | null;
            calculatedScore: number;
            status: 'YES' | 'ALT1' | 'ALT2' | 'ALT3' | 'NO';
        };
    };
}

const CompetitionStatus: React.FC<CompetitionStatusProps> = ({ competition }) => {
    const [currentRole, setCurrentRole] = useState<CompetitorRole>('Leader');
    const [judgingSheets, setJudgingSheets] = useState<JudgingSheet[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadJudgingSheets();
    }, [competition.id, currentRole]);

    const loadJudgingSheets = async () => {
        try {
            if (!currentRole) {
                console.error('No current role set');
                setLoading(false);
                return;
            }

            console.log('Loading judging sheets for role:', currentRole);
            const sheets = await db.getJudgingSheets(competition.id, currentRole);
            console.log('Loaded judging sheets:', sheets);
            setJudgingSheets(sheets); // Show all sheets, not just submitted ones
            setLoading(false);
        } catch (error) {
            console.error('Failed to load judging sheets:', error);
            setLoading(false);
        }
    };

    const getScoreFromStatus = (status: string): number => {
        switch (status) {
            case 'YES':
                return 10;
            case 'ALT1':
                return 4.5;
            case 'ALT2':
                return 4.3;
            case 'ALT3':
                return 4.2;
            case 'NO':
            default:
                return 0;
        }
    };

    const getStatusFromRank = (rank: number, requiredYesCount: number, alternateCount: number): string => {
        if (rank <= requiredYesCount) return 'YES';
        if (rank <= requiredYesCount + alternateCount) {
            const altNum = rank - requiredYesCount;
            return `ALT${altNum}`;
        }
        return 'NO';
    };

    const getCompetitorResults = (role: CompetitorRole): CompetitorResults[] => {
        if (!role) {
            console.error('Role is required for getting competitor results');
            return [];
        }

        console.log('Getting competitor results for role:', role);
        console.log('Competition competitors:', competition.competitors);
        console.log('Current judging sheets:', judgingSheets);
        
        // Get chief judge and regular judges who have submitted scores
        const chiefJudge = competition.judges.find(j => j.isChiefJudge);
        const regularJudges = competition.judges.filter(j => !j.isChiefJudge);
        
        console.log('Chief judge:', chiefJudge);
        console.log('Regular judges:', regularJudges);
        
        // Initialize competitor results
        const competitorResults: { [competitorId: string]: CompetitorResults } = {};
        competition.competitors[role].forEach(competitor => {
            competitorResults[competitor.id] = {
                id: competitor.id,
                bibNumber: competitor.bibNumber,
                name: competitor.name,
                chiefJudgeRank: null,
                regularJudgeScores: {},
            };
        });

        console.log('Initial competitor results:', competitorResults);

        // Fill in chief judge ranks
        if (chiefJudge) {
            const chiefJudgeSheet = judgingSheets.find(
                sheet => sheet.judgeId === chiefJudge.id && sheet.role === role.toLowerCase()
            );
            console.log('Chief judge sheet:', chiefJudgeSheet);
            if (chiefJudgeSheet) {
                chiefJudgeSheet.scores.forEach(score => {
                    if (competitorResults[score.competitorId]) {
                        competitorResults[score.competitorId].chiefJudgeRank = score.rank ?? null;
                    }
                });
            }
        }

        // Fill in regular judge scores
        regularJudges.forEach(judge => {
            const judgeSheet = judgingSheets.find(
                sheet => sheet.judgeId === judge.id && sheet.role === role.toLowerCase()
            );
            console.log(`Judge ${judge.name} sheet:`, judgeSheet);
            
            if (judgeSheet) {
                judgeSheet.scores.forEach(score => {
                    if (competitorResults[score.competitorId]) {
                        const status = getStatusFromRank(
                            score.rank || 0,
                            competition.requiredYesCount,
                            competition.alternateCount
                        );
                        competitorResults[score.competitorId].regularJudgeScores[judge.id] = {
                            rawScore: score.rawScore,
                            calculatedScore: getScoreFromStatus(status),
                            status: status as any
                        };
                    }
                });
            }
        });

        const results = Object.values(competitorResults).sort((a, b) => a.bibNumber - b.bibNumber);
        console.log('Final competitor results:', results);
        return results;
    };

    const handleRoleChange = (_: React.SyntheticEvent, newRole: CompetitorRole) => {
        setCurrentRole(newRole);
    };

    // Get all judges, including those with in-progress scores
    const getActiveJudges = (): Judge[] => {
        const activeJudgeIds = new Set(
            judgingSheets
                .filter(sheet => sheet.role === currentRole.toLowerCase())
                .map(sheet => sheet.judgeId)
        );
        return competition.judges
            .filter(judge => !judge.isChiefJudge && activeJudgeIds.has(judge.id));
    };

    const handleEditScores = (judgeId: string) => {
        navigate(`/competition/${competition.id}/judge/${judgeId}`);
    };

    const submittedJudges = getActiveJudges();
    const competitorResults = getCompetitorResults(currentRole);

    const getStatusColor = (status: string): 'success' | 'info' | 'error' => {
        if (status.startsWith('YES')) return 'success';
        if (status.startsWith('ALT')) return 'info';
        return 'error';
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'YES':
                return { color: '#2e7d32' }; // Dark green
            case 'ALT1':
            case 'ALT2':
            case 'ALT3':
                return { color: '#0288d1' }; // Dark blue
            case 'NO':
            default:
                return { color: '#d32f2f' }; // Dark red
        }
    };

    if (loading) {
        return <Typography>Loading...</Typography>;
    }

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, p: 2 }}>
            <Typography variant="h4" gutterBottom>
                {competition.name} - Results
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={currentRole} onChange={handleRoleChange}>
                    <Tab label="Leaders" value="Leader" />
                    <Tab label="Followers" value="Follower" />
                </Tabs>
            </Box>

            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                    Score Legend:
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip label="YES = 10.0" color="success" />
                    <Chip label="ALT1 = 4.5" color="info" />
                    <Chip label="ALT2 = 4.3" color="info" />
                    <Chip label="ALT3 = 4.2" color="info" />
                    <Chip label="NO = 0.0" color="error" />
                </Box>
            </Box>

            <TableContainer 
                component={Paper} 
                sx={{ 
                    mt: 2,
                    overflow: 'auto',
                    '& table': {
                        minWidth: 800, // Ensures table is wide enough to scroll
                    }
                }}
            >
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Bib #</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell align="center">Chief Judge Rank</TableCell>
                            {submittedJudges.map(judge => (
                                <TableCell key={judge.id} align="center">
                                    <Box>
                                        {judge.name}
                                        <Typography variant="caption" display="block">
                                            {judgingSheets.find(s => 
                                                s.judgeId === judge.id && 
                                                s.role === (currentRole.toLowerCase() as 'leader' | 'follower')
                                            )?.submitted 
                                                ? 'Submitted'
                                                : 'In Progress'}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            sx={{ 
                                                cursor: 'pointer', 
                                                color: 'primary.main',
                                                '&:hover': { textDecoration: 'underline' }
                                            }}
                                            onClick={() => handleEditScores(judge.id)}
                                        >
                                            Edit Scores
                                        </Typography>
                                    </Box>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {competitorResults.map(competitor => (
                            <TableRow key={competitor.id}>
                                <TableCell>{competitor.bibNumber}</TableCell>
                                <TableCell>{competitor.name}</TableCell>
                                <TableCell align="center">
                                    {competitor.chiefJudgeRank !== null ? (
                                        <Typography variant="body1" fontWeight="bold">
                                            #{competitor.chiefJudgeRank}
                                        </Typography>
                                    ) : '-'}
                                </TableCell>
                                {submittedJudges.map(judge => {
                                    const score = competitor.regularJudgeScores[judge.id];
                                    return (
                                        <TableCell key={judge.id} align="center">
                                            {score ? (
                                                <Box>
                                                    <Typography variant="body2">
                                                        Raw: {score.rawScore?.toFixed(1) ?? '-'}
                                                    </Typography>
                                                    <Chip
                                                        label={score.status}
                                                        size="small"
                                                        color={getStatusColor(score.status)}
                                                        sx={{ mt: 1 }}
                                                    />
                                                </Box>
                                            ) : '-'}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default CompetitionStatus; 