import React, { useState, useRef } from "react";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARENA_HEIGHT = 260;

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
  const [hudState, setHudState] = useState({
    p1Hp: 100,
    p1Vidas: 3,
    p2Hp: 100,
    p2Vidas: 3,
    log: "FIGHT!",
    winner: null as string | null,
  });

  // 4. Sistema Puro de Física e Regras (Zero chamadas de useState aqui dentro)
  const gameSystem = (entities: any, { events, dispatch }: any) => {
    if (hudState.winner) return entities;

    const p1 = entities.player1;
    const p2 = entities.player2;

    if (!p1 || !p2) return entities;

    // Reset visual de dano por frame
    p1.isHit = false;
    p2.isHit = false;

    // Direção dos sprites
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

        // Hitbox P1 -> P2
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

        // Hitbox P2 -> P1
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

        // Limpeza fora da tela
        if (proj.x < -20 || proj.x > SCREEN_WIDTH + 20) {
          delete entities[key];
        }
      }
    });

    // Comandos de Controle
    if (events && events.length) {
      events.forEach((e: any) => {
        // Movimentos P1
        if (e.type === "MOVE_P1_X") p1.x = Math.max(10, Math.min(SCREEN_WIDTH - 85, p1.x + e.payload));
        if (e.type === "MOVE_P1_Y") p1.y = Math.max(50, Math.min(ARENA_HEIGHT - 80, p1.y + e.payload));

        // Movimentos P2
        if (e.type === "MOVE_P2_X") p2.x = Math.max(10, Math.min(SCREEN_WIDTH - 85, p2.x + e.payload));
        if (e.type === "MOVE_P2_Y") p2.y = Math.max(50, Math.min(ARENA_HEIGHT - 80, p2.y + e.payload));

        // Esquiva
        if (e.type === "HIDE_P1") p1.isHiding = !p1.isHiding;
        if (e.type === "HIDE_P2") p2.isHiding = !p2.isHiding;

        // Ataques
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

    // Regras de KO e Vida
    if (p1.hp <= 0) {
      p1.vidas -= 1;
      p1.hp = 100;
      if (p1.vidas <= 0) {
        dispatch({ type: "GAME_OVER", payload: "Charizard" });
      }
    }

    if (p2.hp <= 0) {
      p2.vidas -= 1;
      p2.hp = 100;
      if (p2.vidas <= 0) {
        dispatch({ type: "GAME_OVER", payload: "Pikachu" });
      }
    }

    // Sincroniza a barra de HUD com o engine de forma segura
    dispatch({
      type: "SYNC_HUD",
      payload: {
        p1Hp: p1.hp,
        p1Vidas: p1.vidas,
        p2Hp: p2.hp,
        p2Vidas: p2.vidas,
      },
    });

    return entities;
  };

  // 5. Manipulador seguro de eventos vindos do GameEngine para a UI
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

  const dispatch = (type: string, payload?: any) => {
    if (engineRef.current && !hudState.winner) {
      engineRef.current.dispatch({ type, payload });
    }
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
        {/* HUD ISOLADO DO LOOP DO JOGO */}
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

        {/* ENGINE */}
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

      {/* CONTROLES */}
      <View style={styles.controlsContainer}>
        {/* P1 CONTROLS */}
        <View style={styles.playerControlSection}>
          <Text style={styles.sectionTitle}>P1 - CONTROLES</Text>
          <View style={styles.dpad}>
            <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P1_Y", -20)}>
              <Text style={styles.btnText}>▲</Text>
            </TouchableOpacity>
            <View style={styles.dpadRow}>
              <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P1_X", -20)}>
                <Text style={styles.btnText}>◄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P1_X", 20)}>
                <Text style={styles.btnText}>►</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P1_Y", 20)}>
              <Text style={styles.btnText}>▼</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionGroup}>
            <TouchableOpacity style={[styles.actionBtn, styles.btnAtk1]} onPress={() => dispatch("ATTACK_P1")}>
              <Text style={styles.btnText}>ATACAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.btnHide]} onPress={() => dispatch("HIDE_P1")}>
              <Text style={styles.btnText}>ESQUIVAR</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* P2 CONTROLS */}
        <View style={styles.playerControlSection}>
          <Text style={styles.sectionTitle}>P2 - CONTROLES</Text>
          <View style={styles.dpad}>
            <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P2_Y", -20)}>
              <Text style={styles.btnText}>▲</Text>
            </TouchableOpacity>
            <View style={styles.dpadRow}>
              <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P2_X", -20)}>
                <Text style={styles.btnText}>◄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P2_X", 20)}>
                <Text style={styles.btnText}>►</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.dbtn} onPress={() => dispatch("MOVE_P2_Y", 20)}>
              <Text style={styles.btnText}>▼</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionGroup}>
            <TouchableOpacity style={[styles.actionBtn, styles.btnAtk2]} onPress={() => dispatch("ATTACK_P2")}>
              <Text style={styles.btnText}>ATACAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.btnHide]} onPress={() => dispatch("HIDE_P2")}>
              <Text style={styles.btnText}>ESQUIVAR</Text>
            </TouchableOpacity>
          </View>
        </View>
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

  controlsContainer: { flex: 1, flexDirection: "row", backgroundColor: "#121212", padding: 8, gap: 8 },
  playerControlSection: { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 8, padding: 8, justifyContent: "space-between" },
  sectionTitle: { color: "#AAA", fontSize: 10, fontWeight: "bold", textAlign: "center" },

  dpad: { alignItems: "center" },
  dpadRow: { flexDirection: "row", gap: 10, marginVertical: 2 },
  dbtn: { backgroundColor: "#2B2B2B", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4, minWidth: 40, alignItems: "center" },

  actionGroup: { flexDirection: "row", gap: 6 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 4, alignItems: "center" },
  btnAtk1: { backgroundColor: "#D32F2F" },
  btnAtk2: { backgroundColor: "#E65100" },
  btnHide: { backgroundColor: "#388E3C" },
  btnText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
});