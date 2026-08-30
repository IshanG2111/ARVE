import React from 'react';
import { MultiStepLoader } from './multi-step-loader';

interface IngestionOverlayProps {
  isOpen: boolean;
  projectName: string;
  onClose?: () => void;
  onComplete?: () => void;
}

const INGESTION_LOADING_STATES = [
  { text: 'Authenticating GitHub repository access' },
  { text: 'Fetching repository tree and commit metadata' },
  { text: 'Streaming files and extracting codebase snapshot' },
  { text: 'Applying security file filtering guardrails' },
  { text: 'Detecting languages, frameworks and package manager' },
  { text: 'Normalizing file manifests and calculating SHA256 hashes' },
  { text: 'Repository snapshot finalized and ready' },
];

export const IngestionOverlay: React.FC<IngestionOverlayProps> = ({
  isOpen,
  projectName,
  onClose,
  onComplete,
}) => {
  return (
    <MultiStepLoader
      loadingStates={INGESTION_LOADING_STATES}
      loading={isOpen}
      duration={1000}
      projectName={projectName}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
};

export default IngestionOverlay;
