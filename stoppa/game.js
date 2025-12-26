
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.visible = false;
        
        const scores = {1: 16, 2: 12, 3: 13, 4: 14, 5: 15, 6: 18, 7: 21, 8: 10, 9: 10, 10: 10};
        this.points = scores[rank] || 0;
        
        // Image path mapping
        let imgSuit = suit;
        if (suit === "denari") imgSuit = "denara";
        this.imagePath = `assets/images/${imgSuit}${rank}.png`;
    }
}

class Player {
    constructor(index, name, isAi) {
        this.index = index;
        this.name = name;
        this.isAi = isAi;
        this.fiches = 20;
        this.cards = [];
        this.previousCards = [];
        this.currentBet = 0;
        this.folded = false;
        this.declaration = null;
    }

    resetRound() {
        this.cards = [];
        this.previousCards = [];
        this.currentBet = 0;
        this.folded = false;
        this.declaration = null;
    }
}

class StoppaGame {
    constructor(humanCount = 1) {
        this.suits = ['spade', 'bastoni', 'coppe', 'denari'];
        this.players = [];
        this.deck = [];
        this.dealerIndex = 0;
        this.currentPlayerIndex = 1;
        this.pot = 0;
        this.handPot = 0;
        this.currentBet = 0;
        this.phase = 0; // 0,1,2,3
        this.state = "WAITING"; // WAITING, BETTING, TALKING, DECLARATION, SHOWDOWN, ROUND_OVER
        this.message = "Welcome to Stoppa!";
        this.dealChoice = 3;
        this.lastRaiser = 0;
        
        // Initialize Players
        for (let i = 0; i < 5; i++) {
            let isAi = i >= humanCount;
            this.players.push(new Player(i, isAi ? `Agent ${i+1}` : `Player ${i+1}`, isAi));
        }
        
        // UI Callback
        this.onStateUpdate = null;
    }

    log(msg) {
        console.log(`[Game] ${msg}`);
        this.message = msg;
        if (this.onStateUpdate) this.onStateUpdate();
    }

    createDeck() {
        this.deck = [];
        for (let s of this.suits) {
            for (let r = 1; r <= 10; r++) {
                this.deck.push(new Card(s, r));
            }
        }
        // Shuffle
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    startRound() {
        // Ante
        for (let p of this.players) {
            if (p.fiches > 0) {
                p.fiches -= 1;
                this.pot += 1;
            }
        }
        
        this.createDeck();
        this.phase = 0;
        this.dealerIndex = (this.dealerIndex + 1) % 5;
        this.currentPlayerIndex = this.dealerIndex;
        this.state = "WAITING";
        
        for (let p of this.players) p.resetRound();
        
        this.log(`${this.players[this.dealerIndex].name} is the dealer.`);
        
        // AI Dealer
        if (this.players[this.dealerIndex].isAi) {
            setTimeout(() => this.setDealChoice(Math.random() < 0.5 ? 2 : 3), 1000);
        } else {
            if (this.onStateUpdate) this.onStateUpdate();
        }
    }

    setDealChoice(choice) {
        this.dealChoice = choice;
        this.dealCards();
    }

    dealCards() {
        let count = 0;
        if (this.phase === 0) count = this.dealChoice;
        else if (this.phase === 1) count = 3;
        else if (this.phase === 2) count = 5 - this.dealChoice;
        else if (this.phase === 3) count = 0;

        if (count > 0) {
            for (let i = 0; i < 5; i++) {
                let pIdx = (this.dealerIndex + 1 + i) % 5;
                let p = this.players[pIdx];
                for (let c = 0; c < count; c++) {
                    if (this.deck.length > 0) p.cards.push(this.deck.pop());
                }
            }
        }

        this.state = "BETTING";
        this.currentPlayerIndex = (this.dealerIndex + 1) % 5;
        this.currentBet = 0;
        this.handPot = 0;
        this.lastRaiser = this.currentPlayerIndex;

        for (let p of this.players) {
            p.currentBet = 0;
            p.folded = false;
            p.declaration = null;
        }

        this.log("Betting started.");
        this.processTurn();
    }

    processTurn() {
        if (this.state === "ROUND_OVER") return;

        let p = this.players[this.currentPlayerIndex];
        
        if (p.isAi) {
            setTimeout(() => this.aiTurn(), 800);
        } else {
            // Wait for human input
            if (this.onStateUpdate) this.onStateUpdate();
        }
    }

    aiTurn() {
        let p = this.players[this.currentPlayerIndex];
        if (this.state === "BETTING") {
            // Heuristic AI
            let actions = this.getValidActions(this.currentPlayerIndex);
            let action = "fold";
            let amount = 0;

            if (actions.includes("call")) action = "call";
            
            // Random raise chance
            if (actions.includes("raise") && Math.random() < 0.3) {
                action = "raise";
                amount = this.currentBet + 1;
            }
            if (this.currentBet === 0 && actions.includes("raise")) {
                action = "raise";
                amount = 1;
            }

            this.step(action, amount);

        } else if (this.state === "TALKING") {
            let score = this.calculateScore(p).score;
            this.resolveDeclaration(this.currentPlayerIndex, score);
        }
    }

    getValidActions(pIdx) {
        if (this.currentBet === 0) return ["fold", "raise"];
        return ["fold", "call", "raise"];
    }

    step(action, amount = 0) {
        let p = this.players[this.currentPlayerIndex];

        if (action === "fold") {
            p.folded = true;
            p.currentBet = -1;
            this.log(`${p.name} folded.`);
        } else if (action === "call") {
            let cost = this.currentBet - p.currentBet;
            if (p.fiches < cost) cost = p.fiches;
            p.fiches -= cost;
            p.currentBet += cost;
            this.handPot += cost;
            this.log(`${p.name} called.`);
        } else if (action === "raise") {
            if (amount > 20) amount = 20;
            if (amount <= this.currentBet) amount = this.currentBet + 1;
            let cost = amount - p.currentBet;
            if (p.fiches < cost) {
                // All in raise?
                amount = p.currentBet + p.fiches;
                cost = p.fiches;
            }
            p.fiches -= cost;
            p.currentBet = amount;
            this.currentBet = amount;
            this.handPot += cost;
            this.lastRaiser = this.currentPlayerIndex;
            this.log(`${p.name} raised to ${amount}.`);
        }

        this.advanceTurn();
    }

    advanceTurn() {
        let attempts = 0;
        while (attempts < 6) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 5;
            attempts++;
            if (!this.players[this.currentPlayerIndex].folded) break;
        }

        let active = this.players.filter(p => !p.folded);
        if (active.length === 1) {
            this.endHand(active[0]);
            return;
        }

        let betsMatched = active.every(p => p.currentBet === this.currentBet);
        if (betsMatched && this.currentPlayerIndex === this.lastRaiser) {
            if (this.currentBet > 0) {
                this.state = "TALKING";
                this.currentPlayerIndex = this.lastRaiser;
                this.log(`${this.players[this.currentPlayerIndex].name} is talking.`);
                this.processTurn();
            } else {
                this.startDeclaration();
            }
        } else {
            this.processTurn();
        }
    }

    startDeclaration() {
        this.state = "DECLARATION";
        this.log("Declaration Phase.");
        
        // Auto declare for AI
        for (let p of this.players) {
            if (p.isAi && !p.folded) {
                p.declaration = this.calculateScore(p).score;
            }
        }
        
        this.checkShowdownReady();
    }

    checkShowdownReady() {
        let humansPending = this.players.some(p => !p.isAi && !p.folded && p.declaration === null);
        if (!humansPending) {
            this.resolveShowdown();
        } else {
            if (this.onStateUpdate) this.onStateUpdate();
        }
    }

    calculateScore(p) {
        let cards = (this.phase === 3) ? [...p.cards, ...p.previousCards] : p.cards;
        let bestScore = 0;
        let bestCards = [];

        for (let suit of this.suits) {
            let suitCards = cards.filter(c => c.suit === suit);
            if (this.phase === 3) {
                suitCards.sort((a, b) => b.points - a.points);
                if (suitCards.length > 3) suitCards = suitCards.slice(0, 3);
            }
            let score = suitCards.reduce((sum, c) => sum + c.points, 0);
            if (score > bestScore) {
                bestScore = score;
                bestCards = suitCards;
            }
        }
        return {score: bestScore, cards: bestCards};
    }

    resolveDeclaration(declarerIdx, declaredScore) {
        // Simplified Logic for Web
        let declarer = this.players[declarerIdx];
        let actual = this.calculateScore(declarer).score;
        if (declaredScore < actual) declaredScore = actual;

        let activeOpps = this.players.filter(p => !p.folded && p.index !== declarerIdx);
        activeOpps.sort((a, b) => this.calculateScore(b).score - this.calculateScore(a).score);

        let winner = declarer;
        let winScore = actual;

        if (activeOpps.length > 0) {
            let bestOpp = activeOpps[0];
            let oppScore = this.calculateScore(bestOpp).score;
            if (oppScore > actual) {
                winner = bestOpp;
                winScore = oppScore;
                this.log(`${declarer.name} stopped by ${winner.name} (${winScore})!`);
            }
        }

        if (winner === declarer) {
            this.log(`${winner.name} wins declaration (${winScore})!`);
        }

        this.revealWinner(winner);
    }

    resolveShowdown() {
        let active = this.players.filter(p => !p.folded);
        if (active.length === 0) return;

        active.sort((a, b) => this.calculateScore(b).score - this.calculateScore(a).score);
        let winner = active[0];
        this.log(`${winner.name} wins showdown!`);
        this.revealWinner(winner);
    }

    revealWinner(winner) {
        let winRes = this.calculateScore(winner);
        winRes.cards.forEach(c => c.visible = true);
        this.endHand(winner);
    }

    endHand(winner) {
        winner.fiches += this.handPot;
        if (this.phase < 3 && this.pot > 0) {
            winner.fiches += 1;
            this.pot -= 1;
        } else if (this.phase === 3) {
            winner.fiches += this.pot;
            this.pot = 0;
        }

        for (let p of this.players) {
            p.previousCards.push(...p.cards);
            p.cards = [];
        }

        this.phase++;
        if (this.phase > 3) {
            this.state = "ROUND_OVER";
            this.log(`Round Over. ${winner.name} won!`);
        } else {
            setTimeout(() => this.dealCards(), 2000);
        }
        if (this.onStateUpdate) this.onStateUpdate();
    }
}
