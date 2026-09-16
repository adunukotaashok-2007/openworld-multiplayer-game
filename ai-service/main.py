# ============================================================
#  PYTHON AI SERVICE — Flask + WebSocket bot brain service
#  Provides advanced bot behavior via Behavior Trees
#  Communicates with Node.js server via REST/WebSocket
# ============================================================

import os
import json
import time
import logging
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from bot_brain.BehaviorTree import BehaviorTree, Selector, Sequence, Action, Condition
from bot_brain.Pathfinding import AStarPathfinder
from bot_brain.CombatAI import CombatDecisionMaker
from bot_brain.DecisionMaker import TacticalDecisionMaker

# ── Configuration ──
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO, format='%(asctime)s [AI] %(message)s')
logger = logging.getLogger(__name__)

GAME_SERVER_URL = os.getenv('GAME_SERVER_URL', 'http://localhost:3000')
PORT = int(os.getenv('AI_PORT', 5000))


class BotManager:
    """Manages all active bot AI instances"""

    def __init__(self):
        self.bots = {}
        self.pathfinder = AStarPathfinder(grid_size=500, cell_size=5)
        self.running = False
        self.tick_rate = 10  # AI ticks per second (lower than game tick)

    def create_bot(self, bot_id: str, name: str, difficulty: str = 'medium') -> dict:
        """Create a new bot with behavior tree AI"""
        combat_ai = CombatDecisionMaker(difficulty)
        tactical_ai = TacticalDecisionMaker()

        # Build behavior tree
        tree = BehaviorTree(
            root=Selector([
                # Priority 1: Survival
                Sequence([
                    Condition(lambda ctx: ctx['health'] < 30),
                    Action(self._flee_action)
                ]),
                # Priority 2: Combat
                Sequence([
                    Condition(lambda ctx: ctx['nearest_enemy_dist'] < 30),
                    Action(combat_ai.decide_action)
                ]),
                # Priority 3: Patrol
                Action(self._patrol_action)
            ])
        )

        bot = {
            'id': bot_id,
            'name': name,
            'difficulty': difficulty,
            'tree': tree,
            'combat_ai': combat_ai,
            'tactical_ai': tactical_ai,
            'state': {
                'position': [0, 1, 0],
                'rotation': 0,
                'health': 100,
                'target': None,
                'action': 'idle',
                'nearest_enemy_dist': 999
            },
            'last_tick': time.time()
        }

        self.bots[bot_id] = bot
        logger.info(f"Bot created: {name} ({difficulty})")
        return {'status': 'created', 'bot_id': bot_id}

    def update_bot(self, bot_id: str, world_state: dict) -> dict:
        """Tick the bot's AI and return desired action"""
        bot = self.bots.get(bot_id)
        if not bot:
            return {'error': 'Bot not found'}

        # Update context from world state
        ctx = bot['state']
        ctx.update(world_state)

        # Run behavior tree
        action = bot['tree'].tick(ctx)

        # Generate movement via pathfinding if needed
        if action.get('move_to'):
            path = self.pathfinder.find_path(
                ctx['position'], action['move_to']
            )
            action['path'] = path

        bot['last_tick'] = time.time()
        return action

    def remove_bot(self, bot_id: str):
        if bot_id in self.bots:
            del self.bots[bot_id]
            logger.info(f"Bot removed: {bot_id}")

    def _flee_action(self, ctx: dict) -> dict:
        """Flee from nearest enemy"""
        if 'nearest_enemy_pos' in ctx:
            enemy = ctx['nearest_enemy_pos']
            flee_dir = [
                ctx['position'][0] - enemy[0],
                0,
                ctx['position'][2] - enemy[2]
            ]
            return {'action': 'flee', 'move_to': flee_dir, 'priority': 'high'}
        return {'action': 'flee', 'move_to': [0, 0, -50]}

    def _patrol_action(self, ctx: dict) -> dict:
        """Patrol between waypoints"""
        import math
        t = time.time() * 0.2
        offset = hash(ctx.get('id', '')) % 100
        target = [
            math.sin(t + offset) * 30,
            1,
            math.cos(t + offset) * 30
        ]
        return {'action': 'patrol', 'move_to': target}


# ── Global bot manager ──
bot_manager = BotManager()


# ── REST API Endpoints ──

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'online',
        'active_bots': len(bot_manager.bots),
        'uptime': time.time()
    })


@app.route('/api/bot/create', methods=['POST'])
def create_bot():
    data = request.json
    result = bot_manager.create_bot(
        bot_id=data.get('bot_id', f'bot_{time.time()}'),
        name=data.get('name', 'Bot'),
        difficulty=data.get('difficulty', 'medium')
    )
    return jsonify(result)


@app.route('/api/bot/update', methods=['POST'])
def update_bot():
    data = request.json
    result = bot_manager.update_bot(
        bot_id=data['bot_id'],
        world_state=data.get('world_state', {})
    )
    return jsonify(result)


@app.route('/api/bot/remove', methods=['POST'])
def remove_bot():
    data = request.json
    bot_manager.remove_bot(data['bot_id'])
    return jsonify({'status': 'removed'})


@app.route('/api/bots/batch_update', methods=['POST'])
def batch_update():
    """Update all bots at once — called by game server each AI tick"""
    data = request.json
    results = {}
    for bot_data in data.get('bots', []):
        result = bot_manager.update_bot(
            bot_id=bot_data['bot_id'],
            world_state=bot_data.get('world_state', {})
        )
        results[bot_data['bot_id']] = result
    return jsonify(results)


# ── Start ──
if __name__ == '__main__':
    logger.info(f"🤖 AI Service starting on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
