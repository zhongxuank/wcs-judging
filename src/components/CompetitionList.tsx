import React, { useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography, SelectChangeEvent, Dialog, DialogTitle, DialogContent, DialogActions, useTheme, useMediaQuery } from '@mui/material';
import { Competition } from '../types/competition';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import DeleteIcon from '@mui/icons-material/Delete';

const getStatusColor = (status: Competition['status']): "success" | "info" | "warning" => {
  switch (status) {
    case 'completed':
      return "success";
    case 'in_progress':
      return "warning";
    case 'pending':
    default:
      return "info";
  }
};

interface CompetitionListProps {
  competitions: Competition[];
  onJudgeSelect: (competitionId: string, judgeId: string) => void;
}

export const CompetitionList: React.FC<CompetitionListProps> = ({ competitions, onJudgeSelect }) => {
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [competitionToDelete, setCompetitionToDelete] = useState<Competition | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleJoinClick = (competition: Competition) => {
    setSelectedCompetition(competition);
    setSelectedJudgeId('');
  };

  const handleViewStatus = (competitionId: string) => {
    navigate(`/results/${competitionId}`);
  };

  const handleDeleteClick = (competition: Competition, event: React.MouseEvent) => {
    event.stopPropagation();
    setCompetitionToDelete(competition);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (competitionToDelete) {
      try {
        await db.deleteCompetition(competitionToDelete.id);
        window.location.reload();
      } catch (error) {
        console.error('Failed to delete competition:', error);
      }
    }
    setDeleteDialogOpen(false);
    setCompetitionToDelete(null);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 2, sm: 0 },
        mb: 3 
      }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.25rem' } }}>
          Competitions
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/setup')}
          sx={{ 
            fontSize: { xs: '0.875rem', sm: '1rem' },
            py: { xs: 1, sm: 1.5 }
          }}
        >
          Create New Competition
        </Button>
      </Box>
      
      {competitions.length === 0 ? (
        <Typography variant="body1" sx={{ mt: 2, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
          No competitions available. Create one to get started!
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {competitions.map((competition) => (
            <Box 
              key={competition.id} 
              sx={{ 
                border: 1, 
                borderColor: 'divider', 
                p: { xs: 1.5, sm: 2 }, 
                borderRadius: 1 
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between', 
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: { xs: 1.5, sm: 0 },
                mb: 2 
              }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontSize: { xs: '1.125rem', sm: '1.25rem' },
                    mb: { xs: 1, sm: 0 }
                  }}
                >
                  {competition.name}
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1 
                }}>
                  <Button
                    variant="contained"
                    color={getStatusColor(competition.status)}
                    onClick={() => handleViewStatus(competition.id)}
                    fullWidth={isMobile}
                    sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                  >
                    View Status
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => handleJoinClick(competition)}
                    fullWidth={isMobile}
                    sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                  >
                    Join
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={(e) => handleDeleteClick(competition, e)}
                    startIcon={<DeleteIcon />}
                    fullWidth={isMobile}
                    sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
              
              {selectedCompetition?.id === competition.id && (
                <FormControl fullWidth>
                  <InputLabel sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Select Judge
                  </InputLabel>
                  <Select
                    value={selectedJudgeId}
                    label="Select Judge"
                    onChange={(event) => {
                      const judgeId = event.target.value;
                      setSelectedJudgeId(judgeId);
                      if (selectedCompetition) {
                        onJudgeSelect(selectedCompetition.id, judgeId);
                      }
                    }}
                    sx={{ 
                      fontSize: { xs: '0.875rem', sm: '1rem' },
                      '& .MuiMenuItem-root': {
                        fontSize: { xs: '0.875rem', sm: '1rem' }
                      }
                    }}
                  >
                    {competition.judges.map((judge) => (
                      <MenuItem key={judge.id} value={judge.id}>
                        {judge.name} {judge.isChiefJudge ? '(Chief Judge)' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          ))}
        </Box>
      )}

      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Are you sure you want to delete the competition "{competitionToDelete?.name}"? 
            This action cannot be undone and will delete all associated judging sheets.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};