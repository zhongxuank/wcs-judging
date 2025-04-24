import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import {
    Box,
    Container,
    CssBaseline,
    ThemeProvider,
    createTheme,
    useMediaQuery,
    AppBar,
    Toolbar,
    Typography,
    IconButton,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import CompetitionSetup from './components/CompetitionSetup'
import { CompetitionList } from './components/CompetitionList'
import JudgingSheet from './components/JudgingSheet'
import { Competition, Judge } from './types/competition'
import { db } from './services/db'
import CompetitionStatus from './components/CompetitionStatus'

// Create a wrapper component for CompetitionStatus to handle competition loading
const CompetitionStatusWrapper: React.FC = () => {
    const { competitionId } = useParams<{ competitionId: string }>();
    const [competition, setCompetition] = useState<Competition | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCompetition = async () => {
            if (competitionId) {
                try {
                    const comp = await db.getCompetition(competitionId);
                    setCompetition(comp);
                } catch (error) {
                    console.error('Failed to load competition:', error);
                }
                setLoading(false);
            }
        };
        loadCompetition();
    }, [competitionId]);

    if (loading) {
        return <Typography>Loading...</Typography>;
    }

    if (!competition) {
        return <Typography>Competition not found</Typography>;
    }

    return <CompetitionStatus competition={competition} />;
};

const AppContent: React.FC = () => {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
    const [competitions, setCompetitions] = useState<Competition[]>([])
    const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null)
    const [selectedJudge, setSelectedJudge] = useState<Judge | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        loadCompetitions()
    }, [])

    const loadCompetitions = async () => {
        try {
            const comps = await db.getCompetitions()
            setCompetitions(comps)
        } catch (error) {
            console.error('Failed to load competitions:', error)
        }
    }

    const theme = createTheme({
        palette: {
            mode: prefersDarkMode ? 'dark' : 'light',
        },
    })

    const handleCompetitionSetup = async (competition: Competition) => {
        try {
            await db.saveCompetition(competition)
            await loadCompetitions()
            navigate('/')
        } catch (error) {
            console.error('Failed to save competition:', error)
        }
    }

    const handleCompetitionSelect = (competitionId: string, judgeId: string) => {
        const competition = competitions.find(c => c.id === competitionId)
        if (!competition) return

        const judge = competition.judges.find(j => j.id === judgeId)
        if (judge) {
            setSelectedCompetition(competition)
            setSelectedJudge(judge)
            navigate('/judging')
        }
    }

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Container maxWidth={false}>
                <AppBar position="static">
                    <Toolbar>
                        <IconButton 
                            edge="start" 
                            color="inherit" 
                            onClick={() => navigate('/')}
                            sx={{ mr: 2 }}
                        >
                            <HomeIcon />
                        </IconButton>
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            WCS Judging Platform
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Box sx={{ mt: 4 }}>
                    <Routes>
                        <Route path="/" element={
                            <CompetitionList
                                competitions={competitions}
                                onJudgeSelect={handleCompetitionSelect}
                            />
                        } />
                        <Route path="/setup" element={
                            <CompetitionSetup onSetupComplete={handleCompetitionSetup} />
                        } />
                        <Route path="/judging" element={
                            selectedCompetition && selectedJudge ? (
                                <JudgingSheet
                                    competition={selectedCompetition}
                                    judge={selectedJudge}
                                />
                            ) : (
                                <Typography variant="body1" color="text.secondary">
                                    Please select a competition and judge from the home page
                                </Typography>
                            )
                        } />
                        <Route path="/results/:competitionId" element={<CompetitionStatusWrapper />} />
                    </Routes>
                </Box>
            </Container>
        </ThemeProvider>
    )
}

const App: React.FC = () => {
    return (
        <Router basename="/wcs-judging">
            <AppContent />
        </Router>
    )
}

export default App
