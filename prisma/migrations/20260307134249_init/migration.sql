-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roblox_user_id" TEXT NOT NULL,
    "roblox_username" TEXT,
    "roblox_display_name" TEXT,
    "roblox_avatar_url" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "group_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "role_name" TEXT,
    "api_key" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "group_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creator_type" TEXT NOT NULL,
    "group_profile_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_group_profile_id_fkey" FOREIGN KEY ("group_profile_id") REFERENCES "group_profiles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_places" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "place_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_places_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "asset_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_roblox_user_id_key" ON "users"("roblox_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_profiles_user_id_group_id_key" ON "group_profiles"("user_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_places_project_id_place_id_key" ON "project_places"("project_id", "place_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_entries_project_id_filename_key" ON "asset_entries"("project_id", "filename");
