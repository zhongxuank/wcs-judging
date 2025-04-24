import React, { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    Paper,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stepper,
    Step,
    StepLabel,
    Alert,
    Switch,
    FormControlLabel,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
} from '@mui/material';
import { Competition, CompetitorRole, Judge, CompetitionType, Competitor } from '../types/competition';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import DeleteIcon from '@mui/icons-material/Delete';

interface CompetitionSetupProps {
    onSetupComplete: (competition: Competition) => void;
}

interface CSVCompetitor {
    Name: string;
    Role: string;
    BibNumber: string;
}

interface JudgeSetup {
    id: string;
    name: string;
    isChiefJudge: boolean;
    roles: CompetitorRole[];
    scoringRoles: CompetitorRole[];
}

interface CompetitorWithStatus extends Competitor {
    isRepeat?: boolean;
}

interface HeatSetup {
    number: number;
    competitors: {
        [key in CompetitorRole]: CompetitorWithStatus[];
    };
}

const CompetitionSetup: React.FC<CompetitionSetupProps> = ({
    onSetupComplete,
}) => {
    const [activeStep, setActiveStep] = useState(0);
    const [competitionName, setCompetitionName] = useState('');
    const [competitionType, setCompetitionType] = useState<CompetitionType>('Prelim');
    const [requiredYesCount, setRequiredYesCount] = useState(10);
    const [alternateCount, setAlternateCount] = useState(3);
    const [advancingCount, setAdvancingCount] = useState(20);
    const [competitorFile, setCompetitorFile] = useState<File | null>(null);
    const [competitors, setCompetitors] = useState<{
        [key in CompetitorRole]: Competitor[];
    }>({
        Leader: [],
        Follower: [],
    });
    const [judgeCount, setJudgeCount] = useState<{ [key in CompetitorRole]: number }>({
        Leader: 3,
        Follower: 3,
    });
    const [judges, setJudges] = useState<JudgeSetup[]>([
        { 
            id: uuidv4(), 
            name: 'Chief Judge', 
            isChiefJudge: true,
            roles: ['Leader', 'Follower'],
            scoringRoles: ['Leader', 'Follower']
        }
    ]);
    const [error, setError] = useState<string | null>(null);
    const [heatsCount, setHeatsCount] = useState<number>(2);
    const [competitorsPerHeat, setCompetitorsPerHeat] = useState<number>(6);
    const [heats, setHeats] = useState<HeatSetup[]>([]);

    const steps = [
        'Basic Information',
        'Judge Configuration',
        'Upload Competitors',
        'Configure Heats',
        'Review & Create',
    ];

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setCompetitorFile(file);
            Papa.parse<CSVCompetitor>(file, {
                header: true,
                complete: (results) => {
                    if (results.errors.length > 0) {
                        setError('Error parsing CSV file. Please check the format.');
                        return;
                    }

                    const parsedCompetitors: { [key in CompetitorRole]: Competitor[] } = {
                        Leader: [],
                        Follower: [],
                    };

                    results.data.forEach((row) => {
                        if (!row.Name || !row.Role || !row.BibNumber) {
                            return; // Skip incomplete rows
                        }

                        const role = row.Role as CompetitorRole;
                        if (role !== 'Leader' && role !== 'Follower') {
                            return; // Skip invalid roles
                        }

                        const competitor: Competitor = {
                            id: uuidv4(),
                            name: row.Name,
                            role: role,
                            bibNumber: parseInt(row.BibNumber),
                        };

                        parsedCompetitors[role].push(competitor);
                    });

                    setCompetitors(parsedCompetitors);
                    setError(null);
                },
                error: (error) => {
                    setError(`Error reading file: ${error.message}`);
                },
            });
        }
    };

    const validateJudgeCounts = (): boolean => {
        const regularJudges = judges.filter(j => !j.isChiefJudge);
        const chiefJudge = judges.find(j => j.isChiefJudge);

        if (!chiefJudge) {
            setError('Must have a chief judge');
            return false;
        }

        if (regularJudges.length < 2) {
            setError('Must have at least 2 regular judges');
            return false;
        }

        // Check scoring judges for each role
        const scoringJudgesLeader = regularJudges.filter(j => j.scoringRoles.includes('Leader')).length;
        const scoringJudgesFollower = regularJudges.filter(j => j.scoringRoles.includes('Follower')).length;

        if (scoringJudgesLeader === 0) {
            setError('At least one judge must score Leaders');
            return false;
        }

        if (scoringJudgesFollower === 0) {
            setError('At least one judge must score Followers');
            return false;
        }

        if (scoringJudgesLeader % 2 === 0) {
            setError('Must have an odd number of scoring judges for Leaders');
            return false;
        }

        if (scoringJudgesFollower % 2 === 0) {
            setError('Must have an odd number of scoring judges for Followers');
            return false;
        }

        // Check that each role has at least one judge who can watch
        const hasLeaderJudge = judges.some(j => j.roles.includes('Leader'));
        const hasFollowerJudge = judges.some(j => j.roles.includes('Follower'));

        if (!hasLeaderJudge) {
            setError('At least one judge must be assigned to judge Leaders');
            return false;
        }

        if (!hasFollowerJudge) {
            setError('At least one judge must be assigned to judge Followers');
            return false;
        }

        return true;
    };

    const distributeCompetitorsToHeats = () => {
        const newHeats: HeatSetup[] = [];
        const roles: CompetitorRole[] = ['Leader', 'Follower'];
        
        // Create empty heats
        for (let i = 0; i < heatsCount; i++) {
            newHeats.push({
                number: i + 1,
                competitors: {
                    Leader: [],
                    Follower: []
                }
            });
        }

        // Distribute competitors across heats by bib number
        roles.forEach(role => {
            // Sort competitors by bib number
            const sortedCompetitors = [...competitors[role]].sort(
                (a, b) => a.bibNumber - b.bibNumber
            );

            let currentIndex = 0;

            // Fill each heat to capacity
            for (let heatIndex = 0; heatIndex < heatsCount; heatIndex++) {
                const heatCompetitors: CompetitorWithStatus[] = [];

                // Fill this heat to capacity
                for (let i = 0; i < competitorsPerHeat; i++) {
                    if (currentIndex < sortedCompetitors.length) {
                        // Add original competitor
                        heatCompetitors.push({
                            ...sortedCompetitors[currentIndex],
                            isRepeat: false
                        });
                        currentIndex++;
                    } else {
                        // Need to reuse a competitor from the beginning
                        const repeatIndex = (i - (sortedCompetitors.length - currentIndex)) % sortedCompetitors.length;
                        heatCompetitors.push({
                            ...sortedCompetitors[repeatIndex],
                            isRepeat: true
                        });
                    }
                }

                newHeats[heatIndex].competitors[role] = heatCompetitors;
            }
        });

        setHeats(newHeats);
    };

    const validateHeatConfiguration = (): boolean => {
        const maxCompetitors = Math.max(competitors.Leader.length, competitors.Follower.length);
        const minCompetitors = Math.min(competitors.Leader.length, competitors.Follower.length);
        
        if (heatsCount < 1) {
            setError('Must have at least one heat.');
            return false;
        }

        if (competitorsPerHeat < 2) {
            setError('Must have at least 2 competitors per heat.');
            return false;
        }

        // Show informational message about repeat dancers if needed
        const totalSlotsNeeded = heatsCount * competitorsPerHeat;
        if (totalSlotsNeeded > minCompetitors) {
            setError(`Note: Some dancers will perform multiple times to fill all heats (${totalSlotsNeeded} slots total)`);
            // This is just informational, not an error
            return true;
        }

        return true;
    };

    const handleNext = () => {
        if (activeStep === 0) {
            if (!competitionName.trim()) {
                setError('Please enter a competition name');
                return;
            }
            if (competitionType === 'Final') {
                setError('Finals setup is not yet implemented');
                return;
            }
            if (requiredYesCount > advancingCount) {
                setError('Required Yes count cannot be greater than the number of advancing competitors');
                return;
            }
            if (alternateCount < 2 || alternateCount > 3) {
                setError('Number of alternates must be either 2 or 3');
                return;
            }
        }

        if (activeStep === 1) {
            if (judges.length < 2) {
                setError('Please configure at least one regular judge in addition to the chief judge');
                return;
            }
            if (!validateJudgeCounts()) {
                return;
            }
        }

        if (activeStep === 2 && (!competitors.Leader.length || !competitors.Follower.length)) {
            setError('Please upload competitor list');
            return;
        }

        if (activeStep === 3) {
            if (!validateHeatConfiguration()) {
                return;
            }
            distributeCompetitorsToHeats();
        }

        if (activeStep === steps.length - 1) {
            // Create the competition object
            const competition: Competition = {
                id: uuidv4(),
                name: competitionName,
                type: competitionType,
                status: 'pending',
                judges: judges.map(j => ({
                    id: j.id,
                    name: j.name,
                    status: 'pending',
                    roles: j.roles,
                    isChiefJudge: j.isChiefJudge
                })),
                competitors: competitors,
                requiredYesCount: requiredYesCount,
                advancingCount: advancingCount,
                alternateCount: alternateCount
            };
            onSetupComplete(competition);
        } else {
            setActiveStep((prevStep) => prevStep + 1);
            setError(null);
        }
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
        setError(null);
    };

    const handleAddJudge = () => {
        setJudges(prev => [
            ...prev,
            {
                id: uuidv4(),
                name: `Judge ${prev.length}`,
                isChiefJudge: false,
                roles: ['Leader', 'Follower'],
                scoringRoles: ['Leader', 'Follower']
            }
        ]);
    };

    const handleRemoveJudge = (id: string) => {
        if (judges.length <= 2) {
            setError('Cannot remove judge. Minimum of two judges required.');
            return;
        }
        setJudges(prev => prev.filter(j => j.id !== id));
    };

    const handleJudgeRoleChange = (judgeId: string, role: CompetitorRole, checked: boolean) => {
        setJudges(prev => prev.map(judge => {
            if (judge.id === judgeId) {
                const newRoles = checked 
                    ? [...judge.roles, role]
                    : judge.roles.filter(r => r !== role);
                // If a judge can't watch a role, they can't score it either
                const newScoringRoles = judge.scoringRoles.filter(r => newRoles.includes(r));
                return { 
                    ...judge,
                    roles: newRoles,
                    scoringRoles: newScoringRoles
                };
            }
            return judge;
        }));
    };

    const handleScoringRoleChange = (judgeId: string, role: CompetitorRole, checked: boolean) => {
        setJudges(prev => {
            const updatedJudges = prev.map(judge => {
                if (judge.id === judgeId) {
                    // Can only score roles they can judge
                    if (!judge.roles.includes(role)) return judge;
                    
                    const newScoringRoles = checked
                        ? [...judge.scoringRoles, role]
                        : judge.scoringRoles.filter(r => r !== role);
                    return { 
                        ...judge,
                        scoringRoles: newScoringRoles
                    };
                }
                return judge;
            });

            // Count scoring judges for this role after the change
            const scoringJudgeCount = updatedJudges
                .filter(j => !j.isChiefJudge && j.scoringRoles.includes(role))
                .length;

            // If this would create an even number of scoring judges, prevent it
            if (scoringJudgeCount > 0 && scoringJudgeCount % 2 === 0) {
                setError(`Must have an odd number of scoring judges for ${role}s`);
                return prev; // Keep previous state
            }

            setError(null);
            return updatedJudges;
        });
    };

    const renderBasicInfo = () => (
        <Box sx={{ p: 2 }}>
            <TextField
                fullWidth
                label="Competition Name"
                value={competitionName}
                onChange={(e) => setCompetitionName(e.target.value)}
                sx={{ mb: 3 }}
            />
            
            <Typography variant="subtitle1" gutterBottom>
                Competition Type
            </Typography>
            <ToggleButtonGroup
                value={competitionType}
                exclusive
                onChange={(e, newValue) => {
                    if (newValue !== null) {
                        setCompetitionType(newValue);
                    }
                }}
                sx={{ mb: 3 }}
            >
                <ToggleButton value="Prelim">
                    Preliminary Round
                </ToggleButton>
                <ToggleButton value="Final" disabled>
                    Finals (Coming Soon)
                </ToggleButton>
            </ToggleButtonGroup>

            <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        type="number"
                        label="Required Yes Count per Judge"
                        value={requiredYesCount}
                        onChange={(e) => {
                            const value = Math.max(1, parseInt(e.target.value) || 1);
                            setRequiredYesCount(value);
                        }}
                        helperText="Number of YES marks each judge should give"
                        InputProps={{ inputProps: { min: 1 } }}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        type="number"
                        label="Number of Advancing Competitors"
                        value={advancingCount}
                        onChange={(e) => {
                            const value = Math.max(1, parseInt(e.target.value) || 1);
                            setAdvancingCount(value);
                        }}
                        helperText="Number of competitors that will advance"
                        InputProps={{ inputProps: { min: 1 } }}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        type="number"
                        label="Number of Alternates"
                        value={alternateCount}
                        onChange={(e) => {
                            const value = Math.max(2, Math.min(3, parseInt(e.target.value) || 2));
                            setAlternateCount(value);
                        }}
                        helperText="Number of alternates (2 or 3)"
                        InputProps={{ inputProps: { min: 2, max: 3 } }}
                    />
                </Grid>
            </Grid>

            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );

    const renderJudgeConfig = () => (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                Configure Judges
            </Typography>
            {judges.map((judge) => (
                <Paper key={judge.id} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                label={judge.isChiefJudge ? "Chief Judge Name" : "Judge Name"}
                                value={judge.name}
                                onChange={(e) => {
                                    setJudges(prev => prev.map(j => 
                                        j.id === judge.id ? { ...j, name: e.target.value } : j
                                    ));
                                }}
                                disabled={judge.isChiefJudge}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Can Judge:
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={judge.roles.includes('Leader')}
                                            onChange={(e) => handleJudgeRoleChange(judge.id, 'Leader', e.target.checked)}
                                        />
                                    }
                                    label="Leaders"
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={judge.roles.includes('Follower')}
                                            onChange={(e) => handleJudgeRoleChange(judge.id, 'Follower', e.target.checked)}
                                        />
                                    }
                                    label="Followers"
                                />
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Scores Count For:
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={judge.scoringRoles.includes('Leader')}
                                            onChange={(e) => handleScoringRoleChange(judge.id, 'Leader', e.target.checked)}
                                            disabled={!judge.roles.includes('Leader')}
                                        />
                                    }
                                    label="Leaders"
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={judge.scoringRoles.includes('Follower')}
                                            onChange={(e) => handleScoringRoleChange(judge.id, 'Follower', e.target.checked)}
                                            disabled={!judge.roles.includes('Follower')}
                                        />
                                    }
                                    label="Followers"
                                />
                            </Box>
                        </Grid>
                        {!judge.isChiefJudge && (
                            <Grid item xs={12} sm={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <IconButton
                                    onClick={() => handleRemoveJudge(judge.id)}
                                    color="error"
                                    size="small"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Grid>
                        )}
                    </Grid>
                </Paper>
            ))}
            <Button
                variant="outlined"
                onClick={handleAddJudge}
                sx={{ mt: 2 }}
            >
                Add Judge
            </Button>
            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );

    const renderCompetitorUpload = () => (
        <Box sx={{ p: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
                Upload a CSV file with competitor information (Name, Role, Bib Number)
            </Typography>
            <Button variant="contained" component="label">
                Upload Competitors CSV
                <input
                    type="file"
                    hidden
                    accept=".csv"
                    onChange={handleFileUpload}
                />
            </Button>
            {competitorFile && (
                <Typography sx={{ mt: 2 }}>
                    File selected: {competitorFile.name}
                </Typography>
            )}
            {competitors.Leader.length > 0 && competitors.Follower.length > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                    Successfully loaded {competitors.Leader.length} Leaders and{' '}
                    {competitors.Follower.length} Followers
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}
        </Box>
    );

    const renderHeatConfig = () => (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                Configure Heats
            </Typography>
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        type="number"
                        label="Number of Heats"
                        value={heatsCount}
                        onChange={(e) => setHeatsCount(Math.max(1, parseInt(e.target.value) || 1))}
                        InputProps={{ inputProps: { min: 1 } }}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        type="number"
                        label="Maximum Competitors per Heat"
                        value={competitorsPerHeat}
                        onChange={(e) => setCompetitorsPerHeat(Math.max(2, parseInt(e.target.value) || 2))}
                        InputProps={{ inputProps: { min: 2 } }}
                    />
                </Grid>
            </Grid>
            <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" color="primary">
                    Heat Configuration Summary:
                </Typography>
                <Typography variant="body2">
                    Total competitors: {competitors.Leader.length} Leaders, {competitors.Follower.length} Followers
                </Typography>
                <Typography variant="body2">
                    Total slots available: {heatsCount * competitorsPerHeat} per role
                </Typography>
                {competitors.Leader.length > 0 && (
                    <Typography variant="body2">
                        Leaders per heat: ~{Math.ceil(competitors.Leader.length / heatsCount)}
                        {competitors.Leader.length % heatsCount !== 0 && " (uneven distribution)"}
                    </Typography>
                )}
                {competitors.Follower.length > 0 && (
                    <Typography variant="body2">
                        Followers per heat: ~{Math.ceil(competitors.Follower.length / heatsCount)}
                        {competitors.Follower.length % heatsCount !== 0 && " (uneven distribution)"}
                    </Typography>
                )}
            </Box>
            {error && (
                <Alert 
                    severity={error.startsWith('Note:') ? "info" : error.startsWith('Warning:') ? "warning" : "error"} 
                    sx={{ mt: 2 }}
                >
                    {error}
                </Alert>
            )}
        </Box>
    );

    const renderReview = () => (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
                Review Competition Setup
            </Typography>
            <Typography variant="body1">
                <strong>Competition Name:</strong> {competitionName}
            </Typography>
            <Typography variant="body1">
                <strong>Competition Type:</strong> {competitionType}
            </Typography>
            <Typography variant="body1">
                <strong>Required Yes Count per Judge:</strong> {requiredYesCount}
            </Typography>
            <Typography variant="body1">
                <strong>Advancing Competitors:</strong> {advancingCount} + {alternateCount} alternates
            </Typography>
            
            <Typography variant="body1" sx={{ mt: 2 }}>
                <strong>Judges ({judges.length}):</strong>
            </Typography>
            <ul>
                {judges.map(judge => (
                    <li key={judge.id}>
                        {judge.name} - {judge.isChiefJudge ? 'Chief Judge' : 'Judge'}
                    </li>
                ))}
            </ul>

            <Typography variant="body1" sx={{ mt: 2 }}>
                <strong>Competitors:</strong>
            </Typography>
            <Typography variant="body2">
                {competitors.Leader.length} Leaders, {competitors.Follower.length} Followers
            </Typography>

            {error && (
                <Alert 
                    severity={error.startsWith('Note:') ? "info" : error.startsWith('Warning:') ? "warning" : "error"} 
                    sx={{ mt: 2 }}
                >
                    {error}
                </Alert>
            )}
        </Box>
    );

    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                return renderBasicInfo();
            case 1:
                return renderJudgeConfig();
            case 2:
                return renderCompetitorUpload();
            case 3:
                return renderHeatConfig();
            case 4:
                return renderReview();
            default:
                return null;
        }
    };

    return (
        <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
            <Typography variant="h4" gutterBottom>
                Competition Setup
            </Typography>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
            {renderStepContent(activeStep)}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    sx={{ mr: 1 }}
                >
                    Back
                </Button>
                <Button
                    variant="contained"
                    onClick={handleNext}
                >
                    {activeStep === steps.length - 1 ? 'Create Competition' : 'Next'}
                </Button>
            </Box>
        </Paper>
    );
};

export default CompetitionSetup; 