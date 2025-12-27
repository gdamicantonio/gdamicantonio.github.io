/**
 * Stoppa - Gioco di Carte Napoletano
 * Versione JavaScript standalone con IA avanzata
 */

class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.visible = false;

        // Punteggi della Primiera
        const scores = {1: 16, 2: 12, 3: 13, 4: 14, 5: 15, 6: 18, 7: 21, 8: 10, 9: 10, 10: 10};
        this.points = scores[rank] || 0;

        // Percorso immagine
        let imgSuit = suit;
        if (suit === "denari") imgSuit = "denara";
        this.imagePath = `assets/images/${imgSuit}${rank}.png`;
    }
}

class Player {
    constructor(index, name, isAi, aiProfile = null) {
        this.index = index;
        this.name = name;
        this.isAi = isAi;
        this.fiches = 20;
        this.cards = [];
        this.previousCards = [];
        this.currentBet = 0;
        this.folded = false;
        this.declaration = null;
        this.aiProfile = aiProfile;
    }

    resetRound() {
        this.cards = [];
        this.previousCards = [];
        this.currentBet = 0;
        this.folded = false;
        this.declaration = null;
    }
}

// Nomi italiani per i giocatori IA
const AI_NAMES = ["Marco", "Luca", "Giuseppe", "Antonio"];

/**
 * Sistema IA avanzato che simula i modelli allenati
 */
class StoppaAI {
    constructor(difficulty = 'intermedio', riskStyle = 'misto') {
        this.difficulty = difficulty;
        this.riskStyle = riskStyle;

        // Competenza per livello di difficoltà (0-1, più alto = meno errori)
        this.competenceMap = {
            'principiante': 0.35,
            'intermedio': 0.65,
            'esperto': 0.85,
            'maestro': 0.95
        };

        // Profili di rischio
        this.riskProfiles = {
            'prudente': { foldBias: 0.3, raiseBias: -0.2, bluffProb: 0.05, raiseAmount: 0.3 },
            'equilibrato': { foldBias: 0.0, raiseBias: 0.0, bluffProb: 0.12, raiseAmount: 0.5 },
            'aggressivo': { foldBias: -0.2, raiseBias: 0.3, bluffProb: 0.25, raiseAmount: 0.8 }
        };
    }

    /**
     * Assegna un profilo casuale o specifico a un giocatore IA
     */
    assignProfile(playerIndex) {
        if (this.riskStyle === 'misto') {
            const profiles = ['prudente', 'equilibrato', 'equilibrato', 'aggressivo'];
            return profiles[playerIndex % profiles.length];
        }
        return this.riskStyle;
    }

    /**
     * Calcola la forza della mano (0-1)
     */
    evaluateHandStrength(player, game) {
        const scoreInfo = game.calculateScore(player);
        const score = scoreInfo.score;

        // Normalizza: max possibile è 55 (7+6+A dello stesso seme)
        let strength = Math.min(score / 55.0, 1.0);

        // Bonus per avere molte carte dello stesso seme
        const cards = game.phase === 3 ? [...player.cards, ...player.previousCards] : player.cards;
        const suitCounts = {};
        for (const c of cards) {
            suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
        }
        const maxSuitCount = Math.max(...Object.values(suitCounts));
        if (maxSuitCount >= 3) strength += 0.1;

        // Considera la fase del gioco
        if (game.phase === 0) {
            // Prima fase, meno informazioni - essere più cauti
            strength *= 0.9;
        } else if (game.phase === 3) {
            // Ultima fase - valutazione più precisa
            strength *= 1.1;
        }

        return Math.min(strength, 1.0);
    }

    /**
     * Calcola pot odds
     */
    calculatePotOdds(game, player) {
        const toCall = game.currentBet - player.currentBet;
        if (toCall <= 0) return 1.0;

        const totalPot = game.pot + game.handPot + toCall;
        return toCall / totalPot;
    }

    /**
     * Decisione principale dell'IA durante le scommesse
     */
    decideBettingAction(player, game) {
        const profile = this.riskProfiles[player.aiProfile] || this.riskProfiles['equilibrato'];
        const competence = this.competenceMap[this.difficulty] || 0.65;

        // Possibilità di errore basata sulla competenza
        if (Math.random() > competence) {
            // Mossa casuale
            const actions = game.getValidActions(player.index);
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            if (randomAction === 'raise') {
                return { action: 'raise', amount: game.currentBet + 1 };
            }
            return { action: randomAction, amount: 0 };
        }

        const handStrength = this.evaluateHandStrength(player, game);
        const potOdds = this.calculatePotOdds(game, player);
        const toCall = game.currentBet - player.currentBet;

        // Calcola valore atteso aggiustato per il profilo
        let ev = handStrength - potOdds;
        ev += profile.foldBias * -0.1;  // Bias per fold
        ev += profile.raiseBias * 0.1;   // Bias per raise

        // Aggiusta per posizione (dopo il raiser è più difficile)
        const positionFromRaiser = (player.index - game.lastRaiser + 5) % 5;
        if (positionFromRaiser <= 2) ev -= 0.05;

        // Decisione
        if (game.currentBet === 0) {
            // Nessuna puntata - decidi se aprire
            if (handStrength > 0.4 + profile.raiseBias * 0.2) {
                const raiseAmount = this.calculateRaiseAmount(player, game, profile);
                return { action: 'raise', amount: raiseAmount };
            }
            // Anche con mano debole, a volte rilancia per bluffare
            if (Math.random() < profile.bluffProb) {
                return { action: 'raise', amount: 1 };
            }
            return { action: 'fold', amount: 0 };
        }

        // C'è una puntata da chiamare
        if (ev > 0.2) {
            // Mano buona - considera rilancio
            if (handStrength > 0.6 && Math.random() < 0.5 + profile.raiseBias) {
                const raiseAmount = this.calculateRaiseAmount(player, game, profile);
                return { action: 'raise', amount: raiseAmount };
            }
            return { action: 'call', amount: 0 };
        } else if (ev > -0.1) {
            // Mano marginale - chiama
            if (toCall <= 2 || handStrength > 0.35) {
                return { action: 'call', amount: 0 };
            }
        }

        // Bluff occasionale
        if (Math.random() < profile.bluffProb * 0.5) {
            return { action: 'raise', amount: game.currentBet + 1 };
        }

        return { action: 'fold', amount: 0 };
    }

    /**
     * Calcola l'importo del rilancio
     */
    calculateRaiseAmount(player, game, profile) {
        const baseRaise = game.currentBet + 1;
        const maxRaise = Math.min(20, player.fiches + player.currentBet);

        // Rilancio proporzionale al profilo
        const raiseRange = maxRaise - baseRaise;
        const raiseMultiplier = profile.raiseAmount;

        let amount = baseRaise + Math.floor(raiseRange * raiseMultiplier * Math.random());
        amount = Math.max(baseRaise, Math.min(maxRaise, amount));

        return amount;
    }

    /**
     * Decisione per la dichiarazione (fase parlata)
     */
    decideDeclaration(player, game) {
        const profile = this.riskProfiles[player.aiProfile] || this.riskProfiles['equilibrato'];
        const actualScore = game.calculateScore(player).score;

        // Possibilità di bluff
        if (Math.random() < profile.bluffProb) {
            let bluffAmount;
            if (player.aiProfile === 'aggressivo') {
                bluffAmount = Math.floor(Math.random() * 15) + 5;
            } else if (player.aiProfile === 'prudente') {
                bluffAmount = Math.floor(Math.random() * 5) + 1;
            } else {
                bluffAmount = Math.floor(Math.random() * 10) + 2;
            }
            return actualScore + bluffAmount;
        }

        return actualScore;
    }
}

class StoppaGame {
    constructor(humanCount = 1, difficulty = 'intermedio', riskStyle = 'misto') {
        this.suits = ['spade', 'bastoni', 'coppe', 'denari'];
        this.players = [];
        this.deck = [];
        this.dealerIndex = 0;
        this.currentPlayerIndex = 1;
        this.pot = 0;
        this.handPot = 0;
        this.currentBet = 0;
        this.phase = 0;
        this.state = "WAITING";
        this.message = "Benvenuto a Stoppa!";
        this.dealChoice = 3;
        this.lastRaiser = 0;

        // Sistema IA
        this.ai = new StoppaAI(difficulty, riskStyle);

        // Inizializza giocatori
        for (let i = 0; i < 5; i++) {
            const isAi = i >= humanCount;
            const name = isAi ? AI_NAMES[(i - humanCount) % AI_NAMES.length] : `Giocatore ${i+1}`;
            const aiProfile = isAi ? this.ai.assignProfile(i - humanCount) : null;
            this.players.push(new Player(i, name, isAi, aiProfile));
        }

        this.onStateUpdate = null;
    }

    log(msg) {
        console.log(`[Stoppa] ${msg}`);
        this.message = msg;
        if (this.onStateUpdate) this.onStateUpdate();
    }

    createDeck() {
        this.deck = [];
        for (const s of this.suits) {
            for (let r = 1; r <= 10; r++) {
                this.deck.push(new Card(s, r));
            }
        }
        // Mescola
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    startRound() {
        // Ante
        for (const p of this.players) {
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

        for (const p of this.players) p.resetRound();

        this.log(`${this.players[this.dealerIndex].name} è il mazziere.`);

        // Mazziere IA
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
                const pIdx = (this.dealerIndex + 1 + i) % 5;
                const p = this.players[pIdx];
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

        for (const p of this.players) {
            p.currentBet = 0;
            p.folded = false;
            p.declaration = null;
        }

        this.log("Scommesse aperte.");
        this.processTurn();
    }

    processTurn() {
        if (this.state === "ROUND_OVER") return;

        const p = this.players[this.currentPlayerIndex];

        if (p.isAi) {
            setTimeout(() => this.aiTurn(), 800 + Math.random() * 400);
        } else {
            if (this.onStateUpdate) this.onStateUpdate();
        }
    }

    aiTurn() {
        const p = this.players[this.currentPlayerIndex];

        if (this.state === "BETTING") {
            const decision = this.ai.decideBettingAction(p, this);
            this.step(decision.action, decision.amount);
        } else if (this.state === "TALKING") {
            const declaredScore = this.ai.decideDeclaration(p, this);
            this.resolveDeclaration(this.currentPlayerIndex, declaredScore);
        }
    }

    getValidActions(pIdx) {
        if (this.currentBet === 0) return ["fold", "raise"];
        return ["fold", "call", "raise"];
    }

    step(action, amount = 0) {
        const p = this.players[this.currentPlayerIndex];

        if (action === "fold") {
            p.folded = true;
            p.currentBet = -1;
            this.log(`${p.name} ha passato.`);

            // FIX CRITICO: Aggiorna lastRaiser se il giocatore che passa era il raiser
            if (this.currentPlayerIndex === this.lastRaiser) {
                const active = this.players.filter(pl => !pl.folded);
                if (active.length > 0) {
                    for (let i = 1; i < 6; i++) {
                        const nextIdx = (this.currentPlayerIndex + i) % 5;
                        if (!this.players[nextIdx].folded) {
                            this.lastRaiser = nextIdx;
                            break;
                        }
                    }
                }
            }
        } else if (action === "call") {
            let cost = this.currentBet - p.currentBet;
            if (p.fiches < cost) cost = p.fiches;
            p.fiches -= cost;
            p.currentBet += cost;
            this.handPot += cost;
            this.log(`${p.name} ha visto.`);
        } else if (action === "raise") {
            if (amount > 20) amount = 20;
            if (amount <= this.currentBet) amount = this.currentBet + 1;
            let cost = amount - p.currentBet;
            if (p.fiches < cost) {
                amount = p.currentBet + p.fiches;
                cost = p.fiches;
            }
            p.fiches -= cost;
            p.currentBet = amount;
            this.currentBet = amount;
            this.handPot += cost;
            this.lastRaiser = this.currentPlayerIndex;
            this.log(`${p.name} ha rilanciato a ${amount}.`);
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

        const active = this.players.filter(p => !p.folded);
        if (active.length === 1) {
            this.endHand(active[0]);
            return;
        }

        // SALVAGUARDIA: Se lastRaiser ha passato, aggiorna al primo giocatore attivo
        if (this.players[this.lastRaiser].folded) {
            for (const p of active) {
                this.lastRaiser = p.index;
                break;
            }
        }

        const betsMatched = active.every(p => p.currentBet === this.currentBet);
        if (betsMatched && this.currentPlayerIndex === this.lastRaiser) {
            if (this.currentBet > 0) {
                this.state = "TALKING";
                this.currentPlayerIndex = this.lastRaiser;
                this.log(`${this.players[this.currentPlayerIndex].name} sta parlando.`);
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
        this.log("Fase di Dichiarazione.");

        // Auto-dichiarazione per IA
        for (const p of this.players) {
            if (p.isAi && !p.folded) {
                p.declaration = this.calculateScore(p).score;
            }
        }

        this.checkShowdownReady();
    }

    checkShowdownReady() {
        const humansPending = this.players.some(p => !p.isAi && !p.folded && p.declaration === null);
        if (!humansPending) {
            this.resolveShowdown();
        } else {
            if (this.onStateUpdate) this.onStateUpdate();
        }
    }

    calculateScore(p) {
        const cards = (this.phase === 3) ? [...p.cards, ...p.previousCards] : p.cards;
        let bestScore = 0;
        let bestCards = [];

        for (const suit of this.suits) {
            let suitCards = cards.filter(c => c.suit === suit);
            if (this.phase === 3) {
                suitCards.sort((a, b) => b.points - a.points);
                if (suitCards.length > 3) suitCards = suitCards.slice(0, 3);
            }
            const score = suitCards.reduce((sum, c) => sum + c.points, 0);
            if (score > bestScore) {
                bestScore = score;
                bestCards = suitCards;
            }
        }
        return { score: bestScore, cards: bestCards };
    }

    resolveDeclaration(declarerIdx, declaredScore) {
        const declarer = this.players[declarerIdx];
        const actual = this.calculateScore(declarer).score;
        if (declaredScore < actual) declaredScore = actual;

        const activeOpps = this.players.filter(p => !p.folded && p.index !== declarerIdx);
        activeOpps.sort((a, b) => this.calculateScore(b).score - this.calculateScore(a).score);

        let winner = declarer;
        let winScore = actual;

        if (activeOpps.length > 0) {
            const bestOpp = activeOpps[0];
            const oppScore = this.calculateScore(bestOpp).score;
            if (oppScore > actual) {
                winner = bestOpp;
                winScore = oppScore;
                this.log(`${declarer.name} stoppato da ${winner.name} (${winScore})!`);
            }
        }

        if (winner === declarer) {
            this.log(`${winner.name} vince la dichiarazione (${winScore})!`);
        }

        this.revealWinner(winner);
    }

    resolveShowdown() {
        const active = this.players.filter(p => !p.folded);
        if (active.length === 0) return;

        active.sort((a, b) => this.calculateScore(b).score - this.calculateScore(a).score);
        const winner = active[0];
        this.log(`${winner.name} vince lo showdown!`);
        this.revealWinner(winner);
    }

    revealWinner(winner) {
        const winRes = this.calculateScore(winner);
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

        for (const p of this.players) {
            p.previousCards.push(...p.cards);
            p.cards = [];
        }

        this.phase++;
        if (this.phase > 3) {
            this.state = "ROUND_OVER";
            this.log(`Mano terminata. ${winner.name} ha vinto!`);
        } else {
            setTimeout(() => this.dealCards(), 2000);
        }
        if (this.onStateUpdate) this.onStateUpdate();
    }
}
