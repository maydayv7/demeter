# Demeter README Images

This directory contains images used in the main README.md file. Below are the specifications for each required image.

## Required Images

### 1. `demeter-dashboard.png`
**Purpose**: Main dashboard screenshot showing the web interface
**Dimensions**: 800x600px (recommended)
**Content**: Should show the main dashboard with:
- Real-time sensor readings (temperature, pH, EC, etc.)
- Current agent status
- Plant health indicators
- Control buttons for manual intervention

### 2. `demeter-architecture.png`
**Purpose**: System architecture diagram
**Dimensions**: 800x600px (recommended)
**Content**: Visual representation of the agent hierarchy showing:
- Supervisor Agent at the top
- Researcher and Judge agents
- Atmospheric and Water agents
- Doctor and Historian agents
- Data flow between agents
- Technology stack indicators (LangGraph, Qdrant, etc.)

### 3. `disease-detection.png`
**Purpose**: Disease detection interface screenshot
**Dimensions**: 600x400px (recommended)
**Content**: Should show:
- Plant image analysis interface
- YOLOv8 detection results
- Disease identification (e.g., leaf spot, powdery mildew)
- Confidence scores
- Treatment recommendations

### 4. `agent-control.png`
**Purpose**: Agent control and monitoring interface
**Dimensions**: 700x500px (recommended)
**Content**: Display showing:
- Active agent statuses
- Agent communication logs
- Manual override controls
- System health indicators
- Real-time decision making display

### 5. `project-structure.png`
**Purpose**: Visual representation of project file structure
**Dimensions**: 400x600px (recommended)
**Content**: Clean visualization of the directory structure showing:
- Main folders (agent/, backend/, frontend/)
- Key files and their relationships
- Technology indicators for each component

## Screenshot Grid Images (1x3 Grid)

These images appear in a grid at the top of the README for quick visual overview.

### 6. `screenshots/system-overview.png`
**Purpose**: Hero screenshot showing the main system dashboard
**Dimensions**: 300x200px (optimized for grid display)
**Content**: Primary dashboard view with:
- Key metrics overview (temperature, humidity, pH)
- System status indicators
- Active alerts or notifications
- Quick action buttons

### 7. `screenshots/agent-control.png`
**Purpose**: Agent orchestration and control interface
**Dimensions**: 300x200px (optimized for grid display)
**Content**: Agent management interface showing:
- Active agent statuses
- Agent communication logs
- Control buttons for agent actions
- Real-time decision indicators

### 8. `screenshots/console-log.png`
**Purpose**: AI agent decision and logging interface
**Dimensions**: 300x200px (optimized for grid display)
**Content**: Console/logs interface displaying:
- Real-time agent decision logs
- Action execution history
- Error messages and warnings
- System status updates and notifications

## Image Guidelines

### Design Requirements
- **Resolution**: High quality (300 DPI minimum)
- **Format**: PNG preferred for screenshots, SVG for diagrams
- **Style**: Clean, professional, modern UI
- **Colors**: Use Demeter brand colors (green theme #4CAF50)
- **Annotations**: Include clear labels and callouts where helpful

### Technical Specifications
- **File Size**: Optimize for web (under 500KB each)
- **Aspect Ratio**: Maintain proper proportions for responsive display
- **Accessibility**: Ensure good contrast and readable text

## Creating Images

### For Screenshots:
1. Set up the application in development mode
2. Navigate to the relevant interface
3. Use browser dev tools or screenshot tools
4. Crop and annotate as needed
5. Save in PNG format

### For Architecture Diagrams:
1. Use tools like Draw.io, Figma, or Lucidchart
2. Follow the agent hierarchy described in the README
3. Use consistent styling and colors
4. Export as high-quality PNG or SVG

### For Project Structure:
1. Use directory visualization tools or create manually
2. Show hierarchical relationships clearly
3. Include file type indicators
4. Keep clean and readable

## Updating Images

When updating the application or architecture:
1. Regenerate relevant screenshots
2. Update architecture diagrams to reflect changes
3. Ensure all images remain current with the codebase
4. Test image display in the README on GitHub

## File Naming Convention

- Use lowercase with hyphens: `image-name.png`
- Be descriptive but concise
- Include version numbers if needed: `dashboard-v2.png`
