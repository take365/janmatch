import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull().default(""),
  endTime: text("end_time").notNull().default(""),
  category: text("category").notNull().default("仕事"),
  notes: text("notes").notNull().default(""),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  eventId: text("event_id").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull().default("My Day API key"),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tournaments = sqliteTable("tournaments", {
  id: text("id").primaryKey(), owner: text("owner").notNull(), ownerUserId: text("owner_user_id"), name: text("name").notNull(), gameType: text("game_type").notNull(), startAt: text("start_at").notNull(), password: text("password").notNull(), rounds: integer("rounds").notNull(), pairingMode: text("pairing_mode").notNull(), uma: text("uma").notNull(), notice: text("notice").notNull().default(""), phase: text("phase").notNull().default("before"), discordChannelId: text("discord_channel_id"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const tournamentEntries = sqliteTable("tournament_entries", { id: text("id").primaryKey(), tournamentId: text("tournament_id").notNull(), userId: text("user_id"), nickname: text("nickname").notNull(), gameName: text("game_name").notNull().default(""), round: integer("round").notNull(), joined: integer("joined", { mode: "boolean" }).notNull().default(true), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`) });
export const tournamentRounds = sqliteTable("tournament_rounds", {
  tournamentId: text("tournament_id").notNull(),
  round: integer("round").notNull(),
  status: text("status").notNull().default("受付前"),
  stateJson: text("state_json").notNull().default("{\"tables\":[]}"),
  version: integer("version").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const tournamentNotifications = sqliteTable("tournament_notifications", {
  eventKey: text("event_key").primaryKey(),
  tournamentId: text("tournament_id").notNull(),
  round: integer("round"),
  eventType: text("event_type").notNull(),
  sentAt: text("sent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const profiles = sqliteTable("profiles", {
  sessionId: text("session_id").primaryKey(),
  nickname: text("nickname").notNull(),
  gameName: text("game_name").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const operationRequests = sqliteTable("operation_requests", {
  id: text("id").primaryKey(), interactionId: text("interaction_id"), actorUserId: text("actor_user_id"), actorDiscordUserId: text("actor_discord_user_id").notNull(), guildId: text("guild_id"), channelId: text("channel_id"), operationType: text("operation_type").notNull(), status: text("status").notNull(), reason: text("reason").notNull().default(""), beforeSummary: text("before_summary").notNull().default(""), afterSummary: text("after_summary").notNull().default(""), errorMessage: text("error_message").notNull().default(""), confirmationToken: text("confirmation_token"), confirmationExpiresAt: text("confirmation_expires_at"), argumentsJson: text("arguments_json").notNull().default(""), actorRolesJson: text("actor_roles_json").notNull().default("[]"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), completedAt: text("completed_at"),
});

export const agentMessages = sqliteTable("agent_messages", {
  id: text("id").primaryKey(), tournamentId: text("tournament_id"), channelId: text("channel_id").notNull(), discordUserId: text("discord_user_id").notNull(), role: text("role").notNull(), content: text("content").notNull(), interactionId: text("interaction_id"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
