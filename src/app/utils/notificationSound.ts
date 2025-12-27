// Notification sound utility
// Plays sound when new message arrives (only when app is open)

class NotificationSound {
    private audioContext: AudioContext | null = null;
    private enabled: boolean = true;

    constructor() {
        // Initialize AudioContext on user interaction
        if (typeof window !== 'undefined') {
            this.enabled = localStorage.getItem('notificationSoundEnabled') !== 'false';
        }
    }

    private initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    // Play notification sound using Web Audio API (works on iOS)
    async playNotificationSound() {
        if (!this.enabled) return;

        try {
            this.initAudioContext();
            if (!this.audioContext) return;

            // Create a pleasant notification sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // Notification tone (two beeps)
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.1);

            // Fade in and out
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.15);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.15);

            // Vibrate if supported (works on mobile)
            if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]);
            }
        } catch (error) {
            console.warn('Could not play notification sound:', error);
        }
    }

    // Play sent message sound (lighter tone)
    async playSentSound() {
        if (!this.enabled) return;

        try {
            this.initAudioContext();
            if (!this.audioContext) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.08);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.08);
        } catch (error) {
            console.warn('Could not play sent sound:', error);
        }
    }

    // Toggle sound on/off
    toggleSound(enabled: boolean) {
        this.enabled = enabled;
        if (typeof window !== 'undefined') {
            localStorage.setItem('notificationSoundEnabled', String(enabled));
        }
    }

    isEnabled() {
        return this.enabled;
    }
}

export const notificationSound = new NotificationSound();
