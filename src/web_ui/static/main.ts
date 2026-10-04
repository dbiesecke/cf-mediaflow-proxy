// Main entry point for the enhanced WebUI
import './styles.css';
import { initApp } from './app';

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}