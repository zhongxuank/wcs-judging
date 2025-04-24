import React, { useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography, SelectChangeEvent, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Competition, CompetitionStatus } from '../types/competition';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import DeleteIcon from '@mui/icons-material/Delete';

const getStatusColor = (status: CompetitionStatus): "success" | "info" | "warning" => {
  switch (status) {
    case 'completed':
      return "success";
    case 'active':
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
        // Refresh the page to update the list
        window.location.reload();
      } catch (error) {
        console.error('Failed to delete competition:', error);
      }
    }
    setDeleteDialogOpen(false);
    setCompetitionToDelete(null);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Competitions
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/setup')}
        >
          Create New Competition
        </Button>
      </Box>
      
      {competitions.length === 0 ? (
        <Typography variant="body1" sx={{ mt: 2 }}>
          No competitions available. Create one to get started!
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {competitions.map((competition) => (
            <Box key={competition.id} sx={{ border: 1, borderColor: 'divider', p: 2, borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">{competition.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color={getStatusColor(competition.status)}
                    onClick={() => handleViewStatus(competition.id)}
                  >
                    View Status
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => handleJoinClick(competition)}
                  >
                    Join
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={(e) => handleDeleteClick(competition, e)}
                    startIcon={<DeleteIcon />}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
              
              {selectedCompetition?.id === competition.id && (
                <FormControl fullWidth>
                  <InputLabel>Select Judge</InputLabel>
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

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the competition "{competitionToDelete?.name}"? 
            This action cannot be undone and will delete all associated judging sheets.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};