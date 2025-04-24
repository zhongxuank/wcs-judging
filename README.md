# West Coast Swing Judging Platform

A web-based platform for managing West Coast Swing dance competitions, designed for chief judges and scorers to efficiently manage competitions, track scores, and calculate results.

## Features

- Competition Setup
  - Configure multiple rounds (prelims, quarter-finals, semi-finals, finals)
  - Upload competitor lists with bib numbers
  - Configure judge assignments for Leader and Follower roles
  - Set up heats for each round

- Judging Interface
  - Mobile-friendly scoring interface
  - Slider-based scoring system (0-100)
  - Real-time score submission
  - Support for 3, 5, or 7 judges per role

- Scoring System
  - Automatic calculation of Yes/No/Alt results
  - Points system:
    - Yes: 10 points
    - Alt1: 4.5 points
    - Alt2: 4.3 points
    - Alt3: 4.2 points
    - No: 0 points
  - Chief Judge tiebreaker system
  - Automatic advancement calculation

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/zhongxuank/wcs-judging.git
   cd wcs-judging
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory, ready to be deployed to any static hosting service like GitHub Pages.

## Usage

1. **Competition Setup**
   - Enter competition name and details
   - Upload competitor list (CSV format)
   - Configure number of judges for each role
   - Set up rounds and heats

2. **Judging**
   - Judges can access their scoring interface
   - Use sliders to score each competitor
   - Submit scores for each heat

3. **Results**
   - View calculated results
   - See who advances to the next round
   - Export results if needed

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
