-- D&D 5e Database Schema (Release 1.3 - Final Relational Version)
-- This file contains all the CREATE TABLE statements for the project.
-- Run this script on your MySQL/MariaDB database to create all necessary tables.

-- -----------------------------------------------------
-- Core Gameplay Tables
-- These tables define the fundamental mechanics, rules, and concepts of the game.
-- -----------------------------------------------------

CREATE TABLE `ability_scores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `skills` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `ability_score` varchar(50) DEFAULT NULL,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `languages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `typical_speakers` text,
  `script` varchar(50) DEFAULT NULL,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `alignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `abbreviation` varchar(10) NOT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `rule_sections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` mediumtext,
  `rule_section_index` varchar(100) DEFAULT NULL,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

-- -----------------------------------------------------
-- Character Build Tables
-- These tables define the options available for character creation and progression,
-- including races, classes, backgrounds, and the join tables that link them together.
-- -----------------------------------------------------

CREATE TABLE `backgrounds` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `starting_proficiencies` text,
  `language_options` text,
  `starting_equipment` text,
  `feature_name` varchar(100) DEFAULT NULL,
  `feature_desc` text,
  `personality_traits` text,
  `ideals` text,
  `bonds` text,
  `flaws` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `feats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `prerequisites` text,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `races` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `speed` int(11) DEFAULT NULL,
  `ability_bonuses` text,
  `alignment` text,
  `age` text,
  `size` varchar(50) DEFAULT NULL,
  `size_description` text,
  `language_desc` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `race_proficiencies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `race_index` varchar(100) NOT NULL,
  `proficiency_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `race_prof_unique` (`race_index`,`proficiency_index`)
);

CREATE TABLE `race_languages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `race_index` varchar(100) NOT NULL,
  `language_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `race_lang_unique` (`race_index`,`language_index`)
);

CREATE TABLE `race_traits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `race_index` varchar(100) NOT NULL,
  `trait_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `race_trait_unique` (`race_index`,`trait_index`)
);

CREATE TABLE `subraces` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `race_index` varchar(100) DEFAULT NULL,
  `description` text,
  `ability_bonuses` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `subrace_proficiencies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subrace_index` varchar(100) NOT NULL,
  `proficiency_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subrace_prof_unique` (`subrace_index`,`proficiency_index`)
);

CREATE TABLE `subrace_languages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subrace_index` varchar(100) NOT NULL,
  `language_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subrace_lang_unique` (`subrace_index`,`language_index`)
);

CREATE TABLE `subrace_traits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subrace_index` varchar(100) NOT NULL,
  `trait_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subrace_trait_unique` (`subrace_index`,`trait_index`)
);

CREATE TABLE `classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `hit_die` int(11) DEFAULT NULL,
  `saving_throws` text,
  `multi_classing` text,
  `spellcasting` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `class_levels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_index` varchar(100) DEFAULT NULL,
  `level` int(11) DEFAULT NULL,
  `ability_score_bonuses` int(11) DEFAULT NULL,
  `prof_bonus` int(11) DEFAULT NULL,
  `features` text,
  `class_specific` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_level_unique` (`class_index`,`level`)
);

CREATE TABLE `class_spells` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_index` varchar(100) DEFAULT NULL,
  `spell_index` varchar(100) DEFAULT NULL,
  `level_acquired` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_spell_unique` (`class_index`,`spell_index`)
);

CREATE TABLE `class_proficiency_choices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_index` varchar(100) DEFAULT NULL,
  `choice_index` int(11) DEFAULT NULL,
  `description` text,
  `choose` int(11) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `options` text,
  PRIMARY KEY (`id`)
);

CREATE TABLE `class_starting_equipment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_index` varchar(100) DEFAULT NULL,
  `equipment_index` varchar(100) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `class_starting_equipment_options` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `class_index` varchar(100) DEFAULT NULL,
  `choice_index` int(11) DEFAULT NULL,
  `description` text,
  `choose` int(11) DEFAULT NULL,
  `options` text,
  PRIMARY KEY (`id`)
);

CREATE TABLE `subclasses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `class_index` varchar(100) DEFAULT NULL,
  `subclass_flavor` text,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `subclass_levels` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subclass_index` varchar(100) DEFAULT NULL,
  `level` int(11) DEFAULT NULL,
  `features` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subclass_level_unique` (`subclass_index`,`level`)
);

CREATE TABLE `subclass_spells` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subclass_index` varchar(100) DEFAULT NULL,
  `spell_index` varchar(100) DEFAULT NULL,
  `prerequisites` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subclass_spell_unique` (`subclass_index`,`spell_index`)
);

CREATE TABLE `features` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `class` varchar(100) DEFAULT NULL,
  `subclass` varchar(100) DEFAULT NULL,
  `level` int(11) DEFAULT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `traits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `trait_races` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `trait_index` varchar(100) NOT NULL,
  `race_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trait_race_unique` (`trait_index`,`race_index`)
);

CREATE TABLE `trait_subraces` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `trait_index` varchar(100) NOT NULL,
  `subrace_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trait_subrace_unique` (`trait_index`,`subrace_index`)
);

CREATE TABLE `trait_proficiencies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `trait_index` varchar(100) NOT NULL,
  `proficiency_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trait_prof_unique` (`trait_index`,`proficiency_index`)
);

CREATE TABLE `proficiencies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `reference_index` varchar(100) DEFAULT NULL,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `proficiency_classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proficiency_index` varchar(100) NOT NULL,
  `class_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prof_class_unique` (`proficiency_index`,`class_index`)
);

CREATE TABLE `proficiency_races` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proficiency_index` varchar(100) NOT NULL,
  `race_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prof_race_unique` (`proficiency_index`,`race_index`)
);

-- -----------------------------------------------------
-- Magic & Combat Tables
-- These tables define spells, combat rules, item properties, and status effects.
-- -----------------------------------------------------

CREATE TABLE `spells` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `higher_level` text,
  `spell_range` varchar(100) DEFAULT NULL,
  `components` varchar(50) DEFAULT NULL,
  `material` text,
  `ritual` tinyint(1) DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  `concentration` tinyint(1) DEFAULT NULL,
  `casting_time` varchar(100) DEFAULT NULL,
  `spell_level` int(11) DEFAULT NULL,
  `school_index` varchar(50) DEFAULT NULL,
  `damage` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `spell_classes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `spell_index` varchar(100) NOT NULL,
  `class_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `spell_class_unique` (`spell_index`,`class_index`)
);

CREATE TABLE `spell_subclasses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `spell_index` varchar(100) NOT NULL,
  `subclass_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `spell_subclass_unique` (`spell_index`,`subclass_index`)
);

CREATE TABLE `magic_schools` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `damage_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `conditions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `weapon_properties` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(50) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

-- -----------------------------------------------------
-- Equipment & Monster Tables
-- These tables define all items, gear, and creatures in the game.
-- -----------------------------------------------------

CREATE TABLE `equipment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `equipment_category_index` varchar(100) DEFAULT NULL,
  `gear_category` varchar(100) DEFAULT NULL,
  `cost` varchar(50) DEFAULT NULL,
  `weight` float DEFAULT NULL,
  `description` text,
  `weapon_category` varchar(100) DEFAULT NULL,
  `weapon_range` varchar(50) DEFAULT NULL,
  `category_range` varchar(100) DEFAULT NULL,
  `damage` text,
  `two_handed_damage` text,
  `range_info` text,
  `properties` text,
  `armor_category` varchar(100) DEFAULT NULL,
  `armor_class` text,
  `str_minimum` int(11) DEFAULT NULL,
  `stealth_disadvantage` tinyint(1) DEFAULT NULL,
  `contents` text,
  `speed_info` text,
  `capacity` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `equipment_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `magic_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `equipment_category_index` varchar(100) DEFAULT NULL,
  `rarity_name` varchar(50) DEFAULT NULL,
  `description` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `monsters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `index` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `size` varchar(50) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `subtype` varchar(50) DEFAULT NULL,
  `alignment` varchar(100) DEFAULT NULL,
  `armor_class` text,
  `hit_points` int(11) DEFAULT NULL,
  `hit_dice` varchar(50) DEFAULT NULL,
  `speed` text,
  `strength` int(11) DEFAULT NULL,
  `dexterity` int(11) DEFAULT NULL,
  `constitution` int(11) DEFAULT NULL,
  `intelligence` int(11) DEFAULT NULL,
  `wisdom` int(11) DEFAULT NULL,
  `charisma` int(11) DEFAULT NULL,
  `damage_vulnerabilities` text,
  `damage_resistances` text,
  `damage_immunities` text,
  `senses` text,
  `languages` varchar(255) DEFAULT NULL,
  `challenge_rating` float DEFAULT NULL,
  `xp` int(11) DEFAULT NULL,
  `special_abilities` text,
  `actions` text,
  `legendary_actions` text,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `index` (`index`)
);

CREATE TABLE `monster_proficiencies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `monster_index` varchar(100) NOT NULL,
  `proficiency_index` varchar(100) NOT NULL,
  `value` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `monster_prof_unique` (`monster_index`,`proficiency_index`)
);

CREATE TABLE `monster_condition_immunities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `monster_index` varchar(100) NOT NULL,
  `condition_index` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `monster_cond_unique` (`monster_index`,`condition_index`)
);
