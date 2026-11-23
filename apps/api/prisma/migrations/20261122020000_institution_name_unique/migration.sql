CREATE UNIQUE INDEX "institutions_user_lower_name_key"
  ON "institutions" ("user_id", lower("name"));
