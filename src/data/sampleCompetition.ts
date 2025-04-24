import { Competition, CompetitorRole, JudgeStatus, CompetitionType, CompetitionStatus } from '../types/competition';

export const sampleCompetition: Competition = {
    id: 'sample-comp-1',
    name: 'Sample Competition',
    type: 'strictly' as CompetitionType,
    status: 'in_progress' as CompetitionStatus,
    requiredYesCount: 3,
    alternateCount: 2,
    advancingCount: 5, // total of YES + ALT spots
    competitors: {
        Leader: [
            { id: 'L1', name: 'John Smith', bibNumber: 101, role: 'Leader' },
            { id: 'L2', name: 'Michael Johnson', bibNumber: 102, role: 'Leader' },
            { id: 'L3', name: 'David Brown', bibNumber: 103, role: 'Leader' },
            { id: 'L4', name: 'James Wilson', bibNumber: 104, role: 'Leader' },
            { id: 'L5', name: 'Robert Taylor', bibNumber: 105, role: 'Leader' },
            { id: 'L6', name: 'William Davis', bibNumber: 106, role: 'Leader' },
            { id: 'L7', name: 'Richard Miller', bibNumber: 107, role: 'Leader' },
            { id: 'L8', name: 'Joseph Anderson', bibNumber: 108, role: 'Leader' },
            { id: 'L9', name: 'Thomas Martinez', bibNumber: 109, role: 'Leader' },
            { id: 'L10', name: 'Charles Robinson', bibNumber: 110, role: 'Leader' }
        ],
        Follower: [
            { id: 'F1', name: 'Emma White', bibNumber: 201, role: 'Follower' },
            { id: 'F2', name: 'Olivia Garcia', bibNumber: 202, role: 'Follower' },
            { id: 'F3', name: 'Sophia Lee', bibNumber: 203, role: 'Follower' },
            { id: 'F4', name: 'Isabella Clark', bibNumber: 204, role: 'Follower' },
            { id: 'F5', name: 'Ava Rodriguez', bibNumber: 205, role: 'Follower' },
            { id: 'F6', name: 'Mia Thompson', bibNumber: 206, role: 'Follower' },
            { id: 'F7', name: 'Charlotte Moore', bibNumber: 207, role: 'Follower' },
            { id: 'F8', name: 'Amelia Jackson', bibNumber: 208, role: 'Follower' },
            { id: 'F9', name: 'Harper Martin', bibNumber: 209, role: 'Follower' }
        ]
    },
    judges: [
        {
            id: 'J1',
            name: 'Chief Judge Smith',
            roles: ['Leader', 'Follower'],
            status: 'pending' as JudgeStatus,
            isChiefJudge: true
        },
        {
            id: 'J2',
            name: 'Judge Johnson',
            roles: ['Leader'],
            status: 'pending' as JudgeStatus,
            isChiefJudge: false
        },
        {
            id: 'J3',
            name: 'Judge Williams',
            roles: ['Follower'],
            status: 'pending' as JudgeStatus,
            isChiefJudge: false
        }
    ]
}; 