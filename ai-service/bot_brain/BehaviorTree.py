# ============================================================
#  BEHAVIOR TREE — Modular AI decision framework for bots
#  Supports Selector, Sequence, Action, Condition, Decorator
# ============================================================

from enum import Enum
from typing import Callable, List, Optional, Any


class NodeStatus(Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    RUNNING = "running"


class TreeNode:
    """Base class for all behavior tree nodes"""

    def __init__(self, name: str = "Node"):
        self.name = name
        self.status = NodeStatus.FAILURE

    def tick(self, context: dict) -> dict:
        raise NotImplementedError


class Selector(TreeNode):
    """OR node: tries children until one succeeds"""

    def __init__(self, children: List[TreeNode], name: str = "Selector"):
        super().__init__(name)
        self.children = children

    def tick(self, context: dict) -> dict:
        for child in self.children:
            result = child.tick(context)
            if isinstance(result, dict) and result.get('action') != 'idle':
                self.status = NodeStatus.SUCCESS
                return result
        self.status = NodeStatus.FAILURE
        return {'action': 'idle'}


class Sequence(TreeNode):
    """AND node: all children must succeed in order"""

    def __init__(self, children: List[TreeNode], name: str = "Sequence"):
        super().__init__(name)
        self.children = children

    def tick(self, context: dict) -> dict:
        last_result = {'action': 'idle'}
        for child in self.children:
            result = child.tick(context)
            if isinstance(result, bool) and not result:
                self.status = NodeStatus.FAILURE
                return {'action': 'idle'}
            last_result = result if isinstance(result, dict) else last_result
        self.status = NodeStatus.SUCCESS
        return last_result


class Condition(TreeNode):
    """Leaf node: evaluates a condition function"""

    def __init__(self, check_fn: Callable[[dict], bool], name: str = "Condition"):
        super().__init__(name)
        self.check_fn = check_fn

    def tick(self, context: dict):
        result = self.check_fn(context)
        self.status = NodeStatus.SUCCESS if result else NodeStatus.FAILURE
        return result


class Action(TreeNode):
    """Leaf node: executes an action function"""

    def __init__(self, action_fn: Callable[[dict], dict], name: str = "Action"):
        super().__init__(name)
        self.action_fn = action_fn

    def tick(self, context: dict) -> dict:
        result = self.action_fn(context)
        self.status = NodeStatus.SUCCESS
        return result


class Decorator(TreeNode):
    """Wraps a single child with modified behavior"""

    def __init__(self, child: TreeNode, name: str = "Decorator"):
        super().__init__(name)
        self.child = child

    def tick(self, context: dict) -> dict:
        return self.child.tick(context)


class Inverter(Decorator):
    """Inverts child's success/failure"""

    def tick(self, context: dict):
        result = self.child.tick(context)
        if isinstance(result, bool):
            return not result
        return result


class BehaviorTree:
    """Complete behavior tree with a root node"""

    def __init__(self, root: TreeNode):
        self.root = root
        self.tick_count = 0

    def tick(self, context: dict) -> dict:
        self.tick_count += 1
        context['_tick'] = self.tick_count
        return self.root.tick(context)

    def reset(self):
        self.tick_count = 0
