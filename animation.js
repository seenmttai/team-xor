class ISXORAnimation {
    constructor() {
        this.initializeAnimation();
        this.createParticles();
        this.setupInteractions();
        this.startSequence();
    }

    initializeAnimation() {
        this.particleField = document.getElementById('particleField');
        this.letterBoxes = document.querySelectorAll('.letter-box');
        this.fullForm = document.querySelector('.full-form');
        this.isSequenceComplete = false;
    }

    createParticles() {
        const particleCount = 50;

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';

            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 20 + 's';
            particle.style.animationDuration = (15 + Math.random() * 10) + 's';

            const size = 1 + Math.random() * 3;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';

            particle.style.opacity = 0.3 + Math.random() * 0.7;

            this.particleField.appendChild(particle);
        }
    }

    setupInteractions() {

        this.letterBoxes.forEach((box, index) => {
            box.addEventListener('mouseenter', () => {
                this.triggerLetterExpansion(box, index);
            });

            box.addEventListener('mouseleave', () => {
                this.resetLetterExpansion(box);
            });

            box.addEventListener('click', () => {
                this.triggerLetterExplode(box);
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.letter-box')) {
                this.triggerFullSequence();
            }
        });

        setTimeout(() => {
            this.autoTriggerSequence();
        }, 3000);
    }

    triggerLetterExpansion(box, index) {

        const ripple = document.createElement('div');
        ripple.className = 'ripple-effect';
        ripple.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: radial-gradient(circle, rgba(0, 255, 255, 0.4), transparent);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: rippleExpand 0.6s ease-out;
            pointer-events: none;
            z-index: 0;
        `;

        box.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);

        const glow = box.querySelector('.glow');
        glow.style.animation = 'none';
        glow.offsetHeight; 
        glow.style.animation = 'glowPulse 0.8s ease-out';
    }

    resetLetterExpansion(box) {
        const glow = box.querySelector('.glow');
        glow.style.animation = '';
    }

    triggerLetterExplode(box) {
        box.classList.add('active');

        for (let i = 0; i < 12; i++) {
            const explosionParticle = document.createElement('div');
            explosionParticle.className = 'explosion-particle';
            explosionParticle.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 4px;
                height: 4px;
                background: #00ffff;
                border-radius: 50%;
                pointer-events: none;
                z-index: 20;
            `;

            const angle = (i / 12) * Math.PI * 2;
            const distance = 100 + Math.random() * 50;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;

            explosionParticle.style.animation = `explode 1s ease-out forwards`;
            explosionParticle.style.setProperty('--x', x + 'px');
            explosionParticle.style.setProperty('--y', y + 'px');

            box.appendChild(explosionParticle);

            setTimeout(() => {
                explosionParticle.remove();
            }, 1000);
        }

        setTimeout(() => {
            box.classList.remove('active');
        }, 1000);
    }

    autoTriggerSequence() {
        if (this.isSequenceComplete) return;

        this.letterBoxes.forEach((box, index) => {
            setTimeout(() => {
                this.triggerLetterExpansion(box, index);
            }, index * 200);
        });

        setTimeout(() => {
            this.animateFullForm();
        }, 2000);
    }

    triggerFullSequence() {
        if (this.isSequenceComplete) return;

        this.isSequenceComplete = true;

        this.letterBoxes.forEach((box, index) => {
            setTimeout(() => {
                this.triggerLetterExplode(box);
            }, index * 150);
        });

        setTimeout(() => {
            this.grandFinale();
        }, 3000);
    }

    animateFullForm() {
        const fullText = this.fullForm.querySelector('.full-text');
        const originalText = 'Integrated Solutions for eXploration, Observation, and Research';

        fullText.innerHTML = '';

        const characters = originalText.split('');
        let currentIndex = 0;

        const typeWriter = () => {
            if (currentIndex < characters.length) {
                const char = characters[currentIndex];
                const span = document.createElement('span');
                span.textContent = char;
                span.style.opacity = '0';
                span.style.transform = 'translateY(20px) scale(0.8)';
                span.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                span.style.display = 'inline-block';

                if (currentIndex === 0 || 
                    (currentIndex > 0 && characters[currentIndex - 1] === ' ')) {
                    const wordStart = currentIndex;
                    let wordEnd = currentIndex;
                    while (wordEnd < characters.length && characters[wordEnd] !== ' ' && characters[wordEnd] !== ',') {
                        wordEnd++;
                    }
                    const word = characters.slice(wordStart, wordEnd).join('');
                    if (['Integrated', 'Solutions', 'eXploration', 'Observation', 'Research'].includes(word)) {
                        span.className = 'highlight';
                    }
                }

                fullText.appendChild(span);

                setTimeout(() => {
                    span.style.opacity = '1';
                    span.style.transform = 'translateY(0) scale(1)';
                }, 50);

                if (span.classList.contains('highlight')) {
                    setTimeout(() => {
                        const ripple = document.createElement('div');
                        ripple.style.cssText = `
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            width: 0;
                            height: 0;
                            background: radial-gradient(circle, rgba(0, 255, 255, 0.3), transparent);
                            border-radius: 50%;
                            transform: translate(-50%, -50%);
                            animation: textRipple 0.6s ease-out;
                            pointer-events: none;
                            z-index: 1;
                        `;
                        span.style.position = 'relative';
                        span.appendChild(ripple);

                        setTimeout(() => ripple.remove(), 600);
                    }, 100);
                }

                currentIndex++;
                setTimeout(typeWriter, 80);
            } else {

                setTimeout(() => {
                    fullText.style.filter = 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.6))';
                    fullText.style.animation = 'finalGlow 2s ease-in-out infinite';
                }, 500);
            }
        };

        typeWriter();
    }

    grandFinale() {

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        for (let wave = 0; wave < 3; wave++) {
            setTimeout(() => {
                for (let i = 0; i < 80; i++) {
                    const particle = document.createElement('div');
                    particle.className = 'finale-particle';
                    particle.style.cssText = `
                        position: fixed;
                        top: ${centerY}px;
                        left: ${centerX}px;
                        width: ${2 + Math.random() * 4}px;
                        height: ${2 + Math.random() * 4}px;
                        background: linear-gradient(45deg, #00ffff, #0080ff, #00ff80);
                        border-radius: 50%;
                        pointer-events: none;
                        z-index: 100;
                        box-shadow: 0 0 15px currentColor;
                    `;

                    const angle = (i / 80) * Math.PI * 2;
                    const distance = 200 + Math.random() * 600;
                    const x = Math.cos(angle) * distance;
                    const y = Math.sin(angle) * distance;
                    const duration = 2 + Math.random() * 3;

                    particle.style.animation = `finaleExplode ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`;
                    particle.style.setProperty('--x', x + 'px');
                    particle.style.setProperty('--y', y + 'px');

                    document.body.appendChild(particle);

                    setTimeout(() => {
                        particle.remove();
                    }, duration * 1000);
                }
            }, wave * 300);
        }

        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: radial-gradient(circle, rgba(0, 255, 255, 0.4), rgba(0, 128, 255, 0.2), transparent);
            pointer-events: none;
            z-index: 99;
            animation: enhancedFlash 1.5s ease-out;
        `;

        document.body.appendChild(flash);

        setTimeout(() => {
            flash.remove();
        }, 1500);
    }

    startSequence() {

        const style = document.createElement('style');
        style.textContent = `
            @keyframes rippleExpand {
                0% { width: 0; height: 0; opacity: 1; }
                50% { width: 150px; height: 150px; opacity: 0.8; }
                100% { width: 300px; height: 300px; opacity: 0; }
            }

            @keyframes glowPulse {
                0% { 
                    transform: translate(-50%, -50%) scale(0); 
                    opacity: 0;
                    filter: blur(20px);
                }
                30% {
                    transform: translate(-50%, -50%) scale(0.8);
                    opacity: 0.8;
                    filter: blur(15px);
                }
                50% { 
                    transform: translate(-50%, -50%) scale(1.2); 
                    opacity: 1;
                    filter: blur(10px);
                }
                100% { 
                    transform: translate(-50%, -50%) scale(1); 
                    opacity: 0.8;
                    filter: blur(5px);
                }
            }

            @keyframes explode {
                0% { 
                    transform: translate(-50%, -50%) scale(1) rotate(0deg); 
                    opacity: 1;
                    filter: brightness(1);
                }
                50% {
                    transform: translate(-50%, -50%) translate(calc(var(--x) * 0.5), calc(var(--y) * 0.5)) scale(1.5) rotate(180deg);
                    opacity: 0.8;
                    filter: brightness(2);
                }
                100% { 
                    transform: translate(-50%, -50%) translate(var(--x), var(--y)) scale(0) rotate(360deg); 
                    opacity: 0;
                    filter: brightness(0.5);
                }
            }

            @keyframes finaleExplode {
                0% { 
                    transform: translate(-50%, -50%) scale(1) rotate(0deg); 
                    opacity: 1;
                    filter: brightness(1) saturate(1);
                }
                25% {
                    transform: translate(-50%, -50%) translate(calc(var(--x) * 0.3), calc(var(--y) * 0.3)) scale(1.2) rotate(90deg);
                    opacity: 0.9;
                    filter: brightness(1.5) saturate(1.5);
                }
                50% {
                    transform: translate(-50%, -50%) translate(calc(var(--x) * 0.7), calc(var(--y) * 0.7)) scale(0.8) rotate(180deg);
                    opacity: 0.7;
                    filter: brightness(2) saturate(2);
                }
                75% {
                    transform: translate(-50%, -50%) translate(calc(var(--x) * 0.9), calc(var(--y) * 0.9)) scale(0.4) rotate(270deg);
                    opacity: 0.3;
                    filter: brightness(1.5) saturate(1.5);
                }
                100% { 
                    transform: translate(-50%, -50%) translate(var(--x), var(--y)) scale(0) rotate(360deg); 
                    opacity: 0;
                    filter: brightness(0.5) saturate(0.5);
                }
            }

            @keyframes enhancedFlash {
                0% { 
                    opacity: 0;
                    background: radial-gradient(circle, rgba(0, 255, 255, 0.4), rgba(0, 128, 255, 0.2), transparent);
                }
                25% {
                    opacity: 0.8;
                    background: radial-gradient(circle, rgba(255, 0, 255, 0.4), rgba(255, 128, 0, 0.2), transparent);
                }
                50% { 
                    opacity: 1;
                    background: radial-gradient(circle, rgba(0, 255, 128, 0.4), rgba(128, 0, 255, 0.2), transparent);
                }
                75% {
                    opacity: 0.6;
                    background: radial-gradient(circle, rgba(255, 255, 0, 0.4), rgba(0, 255, 128, 0.2), transparent);
                }
                100% { 
                    opacity: 0;
                    background: radial-gradient(circle, rgba(0, 255, 255, 0.4), rgba(0, 128, 255, 0.2), transparent);
                }
            }

            @keyframes textRipple {
                0% { width: 0; height: 0; opacity: 1; }
                50% { width: 30px; height: 30px; opacity: 0.8; }
                100% { width: 60px; height: 60px; opacity: 0; }
            }

            @keyframes finalGlow {
                0% { 
                    filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.6));
                    transform: scale(1);
                }
                50% { 
                    filter: drop-shadow(0 0 40px rgba(0, 255, 255, 1));
                    transform: scale(1.02);
                }
                100% { 
                    filter: drop-shadow(0 0 20px rgba(0, 255, 255, 0.6));
                    transform: scale(1);
                }
            }
        `;

        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ISXORAnimation();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        document.dispatchEvent(new Event('click'));
    }
});