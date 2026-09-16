// ============================================================
//  JAVA MATCHMAKING SERVICE — Spring Boot
//  Handles player lobbies, queue, ranking, and matchmaking
// ============================================================

package com.game;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@SpringBootApplication
@RestController
@RequestMapping("/api")
public class MatchmakingApplication {

    // ── In-memory data structures ──
    private final Map<String, PlayerProfile> players = new ConcurrentHashMap<>();
    private final Map<String, Lobby> lobbies = new ConcurrentHashMap<>();
    private final Queue<String> matchmakingQueue = new LinkedList<>();

    public static void main(String[] args) {
        SpringApplication.run(MatchmakingApplication.class, args);
        System.out.println("🎮 Matchmaking Service started on port 8080");
    }

    // ── Player Registration ──
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> registerPlayer(
            @RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "Player");
        String playerId = UUID.randomUUID().toString().substring(0, 8);

        PlayerProfile profile = new PlayerProfile();
        profile.id = playerId;
        profile.name = name;
        profile.rank = 1000; // Starting ELO Rank
        profile.wins = 0;
        profile.losses = 0;
        profile.level = 1;
        profile.xp = 0;

        players.put(playerId, profile);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "registered");
        response.put("playerId", playerId);
        response.put("rank", profile.rank);
        return ResponseEntity.ok(response);
    }

    // ── Join Queue ──
    @PostMapping("/queue/join")
    public ResponseEntity<Map<String, Object>> joinQueue(
            @RequestParam String playerId) {
        if (!players.containsKey(playerId)) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "Player profile not found. Register first."));
        }

        if (!matchmakingQueue.contains(playerId)) {
            matchmakingQueue.add(playerId);
        }

        String targetLobbyId = tryCreateMatch();

        Map<String, Object> response = new HashMap<>();
        response.put("status", "queued");
        response.put("queueSize", matchmakingQueue.size());
        if (targetLobbyId != null) {
            response.put("matchedLobbyId", targetLobbyId);
        }
        return ResponseEntity.ok(response);
    }

    // ── Matchmaking Loop Algorithm ──
    private synchronized String tryCreateMatch() {
        if (matchmakingQueue.size() < 2) {
            return null;
        }

        // Match based on ELO closeness
        List<String> activeInQueue = new ArrayList<>(matchmakingQueue);
        activeInQueue.sort(Comparator.comparingInt(id -> players.get(id).rank));

        for (int i = 0; i < activeInQueue.size() - 1; i++) {
            String p1Id = activeInQueue.get(i);
            String p2Id = activeInQueue.get(i + 1);

            PlayerProfile p1 = players.get(p1Id);
            PlayerProfile p2 = players.get(p2Id);

            int eloDiff = Math.abs(p1.rank - p2.rank);
            if (eloDiff <= 200) { // Rank window match threshold
                matchmakingQueue.remove(p1Id);
                matchmakingQueue.remove(p2Id);

                String lobbyId = "lobby_" + UUID.randomUUID().toString().substring(0, 6);
                Lobby lobby = new Lobby(lobbyId);
                lobby.playerIds.add(p1Id);
                lobby.playerIds.add(p2Id);
                lobbies.put(lobbyId, lobby);

                System.out.println("⚡ Match Created! Lobby: " + lobbyId + " | ELO Diff: " + eloDiff);
                return lobbyId;
            }
        }
        return null;
    }

    // ── Get Matchmaking Status ──
    @GetMapping("/lobby/{lobbyId}")
    public ResponseEntity<Map<String, Object>> getLobbyStatus(@PathVariable String lobbyId) {
        Lobby lobby = lobbies.get(lobbyId);
        if (lobby == null) {
            return ResponseEntity.notFound().build();
        }

        List<PlayerProfile> memberProfiles = lobby.playerIds.stream()
                .map(players::get)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("lobbyId", lobby.id);
        response.put("players", memberProfiles);
        response.put("status", "ready_to_play");
        return ResponseEntity.ok(response);
    }

    // ── Inner Classes ──
    public static class PlayerProfile {
        public String id;
        public String name;
        public int rank;
        public int wins;
        public int losses;
        public int level;
        public int xp;
    }

    public static class Lobby {
        public String id;
        public List<String> playerIds = new ArrayList<>();

        public Lobby(String id) {
            this.id = id;
        }
    }
}
