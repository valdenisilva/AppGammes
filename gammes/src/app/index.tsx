import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  Dimensions,
} from "react-native";
import { GameEngine } from "react-native-game-engine";
import { io } from "socket.io-client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARENA_HEIGHT = 260;

// Substitua pelo IP da sua máquina na mesma rede Wi-Fi se estiver testando localmente
const SOCKET_URL = "http://192.168.1.197:3000";
const socket = io(SOCKET_URL);

// 1. Renderizador de Personagem Otimizado
const CharacterRenderer = ({ x, y, sprite, isHiding, isHit, facing }: any) => {
  if (!sprite) return null;

  return (
    <View
      style={[
        styles.characterBox,
        {
          left: x,
          top: y,
          opacity: isHiding ? 0.4 : 1,
          transform: [
            { scaleX: facing === "left" ? -1 : 1 },
            { scale: isHit ? 1.25 : 1 },
          ],
        },
      ]}
    >
      <Image
        source={{ uri: sprite }}
        style={[styles.sprite, isHit && { tintColor: "#FF0000" }]}
      />
    </View>
  );
};

// 2. Renderizador de Projétil
const ProjectileRenderer = ({ x, y, color }: any) => (
  <View style={[styles.projectileBox, { left: x, top: y, backgroundColor: color }]} />
);

// 3. Entidades Iniciais
const getInitialEntities = () => ({
  player1: {
    x: 30,
    y: 130,
    hp: 100,
    maxHp: 100,
    vidas: 3,
    name: "Pikachu",
    facing: "right",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
    isHiding: false,
    isHit: false,
    renderer: CharacterRenderer,
  },
  player2: {
    x: SCREEN_WIDTH - 105,
    y: 130,
    hp: 100,
    maxHp: 100,
    vidas: 3,
    name: "Charizard",
    facing: "left",
    sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png",
    isHiding: false,
    isHit: false,
    renderer: CharacterRenderer,
  },
});

export default function ArenaPokemonGame() {
  const engineRef = useRef<any>(null);
  const [playerRole, setPlayerRole] = useState<string | null>(null); // "p1" ou "p2"
  const [hudState, setHudState] = useState({
    p1Hp: 100,
    p1Vidas: 3,
    p2Hp: 100,
    p2Vidas: 3,
    log: "Aguardando oponente...",
    winner: null as string | null,
  });

  useEffect(() => {
    // 1. O servidor define se este celular é o Jogador 1 ou Jogador 2
    socket.on("assign-role", (role) => {
      setPlayerRole(role);
      setHudState((prev) => ({
        ...prev,
        log: `Você é o ${role === "p1" ? "Pikachu (P1)" : "Charizard (P2)"}`,
      }));
    });

    // 2. Recebe ações enviadas pelo outro celular via servidor
    socket.on("game-action", (actionData) => {
      if (engineRef.current) {
        engineRef.current.dispatch(actionData);
      }
    });

    return () => {
      socket.off("assign-role");
      socket.off("game-action");
    };
  }, []);

  // 4. Sistema Puro de Física e Regras
  const gameSystem = (entities: any, { events, dispatch }: any) => {
    if (hudState.winner) return entities;

    const p1 = entities.player1;
    const p2 = entities.player2;

    if (!p1 || !p2) return entities;

    p1.isHit = false;
    p2.isHit = false;

    if (p1.x < p2.x) {
      p1.facing = "right";
      p2.facing = "left";
    } else {
      p1.facing = "left";
      p2.facing = "right";
    }

    // Processamento de Projéteis
    Object.keys(entities).forEach((key) => {
      if (key.startsWith("proj_")) {
        const proj = entities[key];
        proj.x += proj.vx;

        if (proj.owner === "p1" && Math.abs(proj.x - p2.x) < 35 && Math.abs(proj.y - p2.y) < 35) {
          if (!p2.isHiding) {
            p2.hp = Math.max(0, p2.hp - 20);
            p2.isHit = true;
            p2.x = Math.min(SCREEN_WIDTH - 80, p2.x + 15);
            dispatch({ type: "UPDATE_HUD", payload: { log: "Pikachu acertou!" } });
          } else {
            dispatch({ type: "UPDATE_HUD", payload: { log: "Charizard esquivou!" } });
          }
          delete entities[key];
        }

        if (proj.owner === "p2" && Math.abs(proj.x - p1.x) < 35 && Math.abs(proj.y - p1.y) < 35) {
          if (!p1.isHiding) {
            p1.hp = Math.max(0, p1.hp - 20);
            p1.isHit = true;
            p1.x = Math.max(10, p1.x - 15);
            dispatch({ type: "UPDATE_HUD", payload: { log: "Charizard acertou!" } });
          } else {
            dispatch({ type: "UPDATE_HUD", payload: { log: "Pikachu esquivou!" } });
          }
          delete entities[key];
        }

        if (proj.x < -20 || proj.x > SCREEN_WIDTH + 20) {
          delete entities[key];
        }
      }
    });

    // Comandos recebidos localmente ou da rede
    if (events && events.length) {
      events.forEach((e: any) => {
        if (e.type === "MOVE_P1_X") p1.x = Math.max(10, Math.min(SCREEN_WIDTH - 85, p1.x + e.payload));
        if (e.type === "MOVE_P1_Y") p1.y = Math.max(50, Math.min(ARENA_HEIGHT - 80, p1.y + e.payload));
        if (e.type === "MOVE_P2_X") p2.x = Math.max(10, Math.min(SCREEN_WIDTH - 85, p2.x + e.payload));
        if (e.type === "MOVE_P2_Y") p2.y = Math.max(50, Math.min(ARENA_HEIGHT - 80, p2.y + e.payload));

        if (e.type === "HIDE_P1") p1.isHiding = !p1.isHiding;
        if (e.type === "HIDE_P2") p2.isHiding = !p2.isHiding;

        if (e.type === "ATTACK_P1") {
          entities[`proj_${Date.now()}`] = {
            x: p1.x + (p1.facing === "right" ? 50 : -10),
            y: p1.y + 25,
            vx: p1.facing === "right" ? 12 : -12,
            owner: "p1",
            color: "#FFD700",
            renderer: ProjectileRenderer,
          };
        }

        if (e.type === "ATTACK_P2") {
          entities[`proj_${Date.now()}`] = {
            x: p2.x + (p2.facing === "right" ? 50 : -10),
            y: p2.y + 25,
            vx: p2.facing === "right" ? 12 : -12,
            owner: "p2",
            color: "#FF5722",
            renderer: ProjectileRenderer,
          };
        }
      });
    }

    if (p1.hp <= 0) {
      p1.vidas -= 1;
      p1.hp = 100;
      if (p1.vidas <= 0) dispatch({ type: "GAME_OVER", payload: "Charizard" });
    }

    if (p2.hp <= 0) {
      p2.vidas -= 1;
      p2.hp = 100;
      if (p2.vidas <= 0) dispatch({ type: "GAME_OVER", payload: "Pikachu" });
    }

    dispatch({
      type: "SYNC_HUD",
      payload: { p1Hp: p1.hp, p1Vidas: p1.vidas, p2Hp: p2.hp, p2Vidas: p2.vidas },
    });

    return entities;
  };

  const handleEvent = (e: any) => {
    if (e.type === "UPDATE_HUD") {
      setHudState((prev) => ({ ...prev, log: e.payload.log }));
    } else if (e.type === "SYNC_HUD") {
      setHudState((prev) => ({
        ...prev,
        p1Hp: e.payload.p1Hp,
        p1Vidas: e.payload.p1Vidas,
        p2Hp: e.payload.p2Hp,
        p2Vidas: e.payload.p2Vidas,
      }));
    } else if (e.type === "GAME_OVER") {
      setHudState((prev) => ({ ...prev, winner: e.payload }));
    }
  };

  // Função modificada: agora envia a ação para o servidor emitir para ambos os celulares
  const sendAction = (type: string, payload?: any) => {
    const action = { type, payload };
    // Envia para o servidor para sincronizar nos dois aparelhos
    socket.emit("player-action", action);
  };

  const resetGame = () => {
    setHudState({
      p1Hp: 100,
      p1Vidas: 3,
      p2Hp: 100,
      p2Vidas: 3,
      log: "FIGHT!",
      winner: null,
    });
    if (engineRef.current) {
      engineRef.current.swap(getInitialEntities());
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={{ uri: "https://i.imgur.com/3ZQ3ZfO.png" }}
        style={styles.arenaBackground}
      >
        <View style={styles.hudOverlay}>
          <View style={styles.playerHud}>
            <Text style={styles.hudName}>Pikachu (P1)</Text>
            <View style={styles.hpTrack}>
              <View style={[styles.hpFill, { width: `${hudState.p1Hp}%` }]} />
            </View>
            <Text style={styles.lifeText}>VIDAS: {hudState.p1Vidas}</Text>
          </View>

          <View style={styles.centerHud}>
            <Text style={styles.vsText}>VS</Text>
            <Text style={styles.logText}>{hudState.log}</Text>
          </View>

          <View style={[styles.playerHud, { alignItems: "flex-end" }]}>
            <Text style={styles.hudName}>Charizard (P2)</Text>
            <View style={styles.hpTrack}>
              <View style={[styles.hpFill, { width: `${hudState.p2Hp}%` }]} />
            </View>
            <Text style={styles.lifeText}>VIDAS: {hudState.p2Vidas}</Text>
          </View>
        </View>

        <GameEngine
          ref={engineRef}
          style={{ flex: 1 }}
          systems={[gameSystem]}
          entities={getInitialEntities()}
          onEvent={handleEvent}
        />

        {hudState.winner && (
          <View style={styles.winnerOverlay}>
            <Text style={styles.winnerText}>{hudState.winner.toUpperCase()} VENCEU!</Text>
            <TouchableOpacity style={styles.btnReset} onPress={resetGame}>
              <Text style={styles.btnResetText}>REINICIAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </ImageBackground>

      {/* CONTROLES SEPARADOS POR APARELHO */}
      <View style={styles.controlsContainer}>
        {!playerRole ? (
          <Text style={styles.waitingText}>Conectando ao servidor...</Text>
        ) : playerRole === "p1" ? (
          /* CONTROLES EXCLUSIVOS DO JOGADOR 1 (PIKACHU) */
          <View style={styles.playerControlSection}>
            <Text style={styles.sectionTitle}>SEUS CONTROLES (Pikachu)</Text>
            <View style={styles.dpad}>
              <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P1_Y", -20)}>
                <Text style={styles.btnText}>▲</Text>
              </TouchableOpacity>
              <View style={styles.dpadRow}>
                <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P1_X", -20)}>
                  <Text style={styles.btnText}>◄</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P1_X", 20)}>
                  <Text style={styles.btnText}>►</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P1_Y", 20)}>
                <Text style={styles.btnText}>▼</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionGroup}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnAtk1]} onPress={() => sendAction("ATTACK_P1")}>
                <Text style={styles.btnText}>ATACAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.btnHide]} onPress={() => sendAction("HIDE_P1")}>
                <Text style={styles.btnText}>ESQUIVAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* CONTROLES EXCLUSIVOS DO JOGADOR 2 (CHARIZARD) */
          <View style={styles.playerControlSection}>
            <Text style={styles.sectionTitle}>SEUS CONTROLES (Charizard)</Text>
            <View style={styles.dpad}>
              <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P2_Y", -20)}>
                <Text style={styles.btnText}>▲</Text>
              </TouchableOpacity>
              <View style={styles.dpadRow}>
                <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P2_X", -20)}>
                  <Text style={styles.btnText}>◄</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P2_X", 20)}>
                  <Text style={styles.btnText}>►</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.dbtn} onPress={() => sendAction("MOVE_P2_Y", 20)}>
                <Text style={styles.btnText}>▼</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionGroup}>
              <TouchableOpacity style={[styles.actionBtn, styles.btnAtk2]} onPress={() => sendAction("ATTACK_P2")}>
                <Text style={styles.btnText}>ATACAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.btnHide]} onPress={() => sendAction("HIDE_P2")}>
                <Text style={styles.btnText}>ESQUIVAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  arenaBackground: { height: ARENA_HEIGHT, width: "100%", borderBottomWidth: 2, borderColor: "#333" },

  hudOverlay: { position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between", zIndex: 10 },
  playerHud: { width: "38%" },
  hudName: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  hpTrack: { height: 10, backgroundColor: "#222", borderWidth: 1, borderColor: "#FFF", borderRadius: 2, marginVertical: 2 },
  hpFill: { height: "100%", backgroundColor: "#00E676" },
  lifeText: { color: "#FFD700", fontSize: 10, fontWeight: "bold" },
  centerHud: { width: "20%", alignItems: "center" },
  vsText: { color: "#FF3D00", fontSize: 16, fontWeight: "900" },
  logText: { color: "#FFF", fontSize: 8, textAlign: "center", fontWeight: "bold" },

  characterBox: { position: "absolute", width: 75, height: 75 },
  sprite: { width: 75, height: 75 },
  projectileBox: { position: "absolute", width: 12, height: 12, borderRadius: 6 },

  winnerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", zIndex: 20 },
  winnerText: { color: "#FFD700", fontSize: 22, fontWeight: "bold", marginBottom: 15 },
  btnReset: { backgroundColor: "#2979FF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  btnResetText: { color: "#FFF", fontWeight: "bold" },

  controlsContainer: { flex: 1, flexDirection: "row", backgroundColor: "#121212", padding: 8, justifyContent: "center" },
  playerControlSection: { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 8, padding: 8, justifyContent: "space-between" },
  sectionTitle: { color: "#AAA", fontSize: 12, fontWeight: "bold", textAlign: "center" },
  waitingText: { color: "#FFF", alignSelf: "center", fontSize: 16 },

  dpad: { alignItems: "center" },
  dpadRow: { flexDirection: "row", gap: 10, marginVertical: 2 },
  dbtn: { backgroundColor: "#2B2B2B", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 4, minWidth: 50, alignItems: "center" },

  actionGroup: { flexDirection: "row", gap: 6 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 4, alignItems: "center" },
  btnAtk1: { backgroundColor: "#D32F2F" },
  btnAtk2: { backgroundColor: "#E65100" },
  btnHide: { backgroundColor: "#388E3C" },
  btnText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
});