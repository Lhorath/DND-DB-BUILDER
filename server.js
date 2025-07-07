// server.js (Final and Complete - Release 1.3)
// This Node.js server uses the Express framework to create API endpoints that fetch data
// from the D&D 5e API and store it in a local MySQL database.
// It also serves a static HTML control panel to trigger these sync operations.

// --- 1. Import necessary packages ---
const express = require('express');
const fetch = require('node-fetch'); // To make HTTP requests to the D&D API
const mysql = require('mysql');     // To connect and query the MySQL database
const path = require('path');       // To handle file paths for serving the frontend

const app = express();
const PORT = 3000;

// --- 2. MySQL Database Configuration ---
// This object holds the connection details for your local database.
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'dnd_db'
};

// --- 3. Express Middleware ---
// This line tells Express to serve any static files (HTML, CSS, client-side JS)
// from a directory named 'public'. This is how the index.html control panel is hosted.
app.use(express.static('public'));


// --- 4. Helper and Generic Functions ---

/**
 * A utility function to "promisify" the standard callback-based mysql query function.
 * This allows us to use async/await with database queries for cleaner code.
 * @param {mysql.Connection} connection - The active database connection.
 * @param {string} sql - The SQL query to execute.
 * @param {Array} values - An array of values to be safely inserted into the query.
 * @returns {Promise<any>} A promise that resolves with the query results.
 */
function queryAsync(connection, sql, values) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}

/**
 * A generic function to sync simple API resources that don't have complex nested data
 * or relational links that need to be broken into separate tables.
 * @param {string} resourceName - The name of the resource in the API (e.g., 'skills').
 * @param {string} tableName - The name of the database table to insert into.
 * @param {Function} recordBuilder - A function that takes the API data and returns a formatted record object and SQL query.
 * @param {express.Response} res - The Express response object.
 */
async function syncResource(resourceName, tableName, recordBuilder, res) {
    console.log(`Received request to sync ${resourceName}...`);
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for ${resourceName} sync.`);
                resolve();
            });
        });

        const listResponse = await fetch(`https://www.dnd5eapi.co/api/${resourceName}`);
        const listData = await listResponse.json();
        const endpoints = listData.results;
        
        const queryPromises = [];

        console.log(`Fetching details for ${endpoints.length} ${resourceName}...`);
        for (const item of endpoints) {
            const detailResponse = await fetch(`https://www.dnd5eapi.co${item.url}`);
            const detailData = await detailResponse.json();
            
            // The recordBuilder function formats the data from the API into a table-ready object.
            const { newRecord, sqlQuery } = await recordBuilder(detailData, tableName);

            const queryPromise = new Promise((resolve, reject) => {
                connection.query(sqlQuery, Object.values(newRecord), (error, results) => {
                    if (error) {
                        console.error(`Database error for ${resourceName}: ${newRecord.name}`, error);
                        return reject(new Error(`Failed on ${resourceName} ${newRecord.name}: ${error.message}`));
                    }
                    resolve(results);
                });
            });
            queryPromises.push(queryPromise);
        }

        console.log(`All ${resourceName} API data fetched. Executing all database queries...`);
        await Promise.all(queryPromises);
        console.log(`${resourceName} database sync complete. ${queryPromises.length} records processed.`);

        res.status(200).json({ success: true, message: `${resourceName} synced successfully! ${queryPromises.length} records processed.` });

    } catch (error) {
        console.error(`An error occurred during the ${resourceName} sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for ${resourceName} closed.`));
        }
    }
}


// --- 5. Specialized Sync Functions ---
// These functions handle complex resources that require fetching nested data and
// populating multiple relational tables within a single database transaction.

async function syncClasses(res) {
    console.log('Received request to sync classes (enriched)...');
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for classes sync.`);
                resolve();
            });
        });

        const listResponse = await fetch('https://www.dnd5eapi.co/api/classes');
        const listData = await listResponse.json();
        const classEndpoints = listData.results;

        for (const classItem of classEndpoints) {
            console.log(`--- Processing class: ${classItem.name} ---`);
            const detailResponse = await fetch(`https://www.dnd5eapi.co${classItem.url}`);
            const detailData = await detailResponse.json();

            const levelsResponse = await fetch(`https://www.dnd5eapi.co${detailData.class_levels}`);
            const levelsData = await levelsResponse.json();

            let spellsData = [];
            if (detailData.spells) {
                const spellsResponse = await fetch(`https://www.dnd5eapi.co${detailData.spells}`);
                const spellsJson = await spellsResponse.json();
                if (spellsJson.results) {
                    spellsData = spellsJson.results;
                }
            }
            
            await new Promise((resolve, reject) => {
                connection.beginTransaction(async (err) => {
                    if (err) { return reject(err); }

                    try {
                        const classRecord = {
                            index: detailData.index, name: detailData.name, hit_die: detailData.hit_die,
                            saving_throws: JSON.stringify(detailData.saving_throws.map(s => s.name)),
                            multi_classing: JSON.stringify(detailData.multi_classing),
                            spellcasting: JSON.stringify(detailData.spellcasting)
                        };
                        const classQuery = "INSERT INTO classes (`index`, `name`, `hit_die`, `saving_throws`, `multi_classing`, `spellcasting`) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `hit_die`=VALUES(hit_die), `saving_throws`=VALUES(saving_throws), `multi_classing`=VALUES(multi_classing), `spellcasting`=VALUES(spellcasting)";
                        await queryAsync(connection, classQuery, Object.values(classRecord));
                        
                        await queryAsync(connection, "DELETE FROM class_levels WHERE class_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM class_spells WHERE class_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM class_proficiency_choices WHERE class_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM class_starting_equipment WHERE class_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM class_starting_equipment_options WHERE class_index = ?", [detailData.index]);
                        
                        for (const level of levelsData) {
                            const levelRecord = { class_index: detailData.index, level: level.level, ability_score_bonuses: level.ability_score_bonuses, prof_bonus: level.prof_bonus, features: JSON.stringify(level.features.map(f => f.name)), class_specific: JSON.stringify(level.class_specific) };
                            await queryAsync(connection, "INSERT INTO class_levels SET ?", levelRecord);
                        }

                        if (Array.isArray(spellsData)) {
                            for (const spell of spellsData) {
                                 await queryAsync(connection, "INSERT INTO class_spells (class_index, spell_index, level_acquired) VALUES (?, ?, ?)", [detailData.index, spell.index, spell.level]);
                            }
                        }
                        
                        for (const [i, choice] of detailData.proficiency_choices.entries()) {
                            const choiceRecord = { class_index: detailData.index, choice_index: i, description: choice.desc, choose: choice.choose, type: choice.type, options: JSON.stringify(choice.from.options.map(o => o.item ? o.item.index : null).filter(Boolean)) };
                            await queryAsync(connection, "INSERT INTO class_proficiency_choices SET ?", choiceRecord);
                        }

                        for (const item of detailData.starting_equipment) {
                             if (item.equipment && item.equipment.index) {
                                await queryAsync(connection, "INSERT INTO class_starting_equipment (class_index, equipment_index, quantity) VALUES (?, ?, ?)", [detailData.index, item.equipment.index, item.quantity]);
                             }
                        }

                        for (const [i, choice] of detailData.starting_equipment_options.entries()) {
                            const choiceRecord = { class_index: detailData.index, choice_index: i, description: choice.desc, choose: choice.choose, options: JSON.stringify(choice.from.options) };
                             await queryAsync(connection, "INSERT INTO class_starting_equipment_options SET ?", choiceRecord);
                        }

                        connection.commit(err => {
                            if (err) { return connection.rollback(() => reject(err)); }
                            console.log(`Successfully committed data for ${classItem.name}`);
                            resolve();
                        });
                    } catch (e) {
                        connection.rollback(() => reject(e));
                    }
                });
            });
        }
        res.status(200).json({ success: true, message: `Classes synced successfully! ${classEndpoints.length} records processed.` });
    } catch (error) {
        console.error(`An error occurred during the classes sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for classes closed.`));
        }
    }
}

async function syncMonsters(res) {
    console.log('Received request to sync monsters (enriched)...');
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for monsters sync.`);
                resolve();
            });
        });

        const listResponse = await fetch('https://www.dnd5eapi.co/api/monsters');
        const listData = await listResponse.json();
        const monsterEndpoints = listData.results;

        for (const monsterItem of monsterEndpoints) {
            console.log(`--- Processing monster: ${monsterItem.name} ---`);
            const detailResponse = await fetch(`https://www.dnd5eapi.co${monsterItem.url}`);
            const detailData = await detailResponse.json();

            await new Promise((resolve, reject) => {
                connection.beginTransaction(async (err) => {
                    if (err) { return reject(err); }

                    try {
                        const monsterRecord = {
                            index: detailData.index, name: detailData.name, size: detailData.size,
                            type: detailData.type, subtype: detailData.subtype || null, alignment: detailData.alignment,
                            armor_class: JSON.stringify(detailData.armor_class),
                            hit_points: detailData.hit_points, hit_dice: detailData.hit_dice,
                            speed: JSON.stringify(detailData.speed),
                            strength: detailData.strength, dexterity: detailData.dexterity,
                            constitution: detailData.constitution, intelligence: detailData.intelligence,
                            wisdom: detailData.wisdom, charisma: detailData.charisma,
                            damage_vulnerabilities: JSON.stringify(detailData.damage_vulnerabilities),
                            damage_resistances: JSON.stringify(detailData.damage_resistances),
                            damage_immunities: JSON.stringify(detailData.damage_immunities),
                            senses: JSON.stringify(detailData.senses),
                            languages: detailData.languages,
                            challenge_rating: detailData.challenge_rating, xp: detailData.xp,
                            special_abilities: JSON.stringify(detailData.special_abilities),
                            actions: JSON.stringify(detailData.actions),
                            legendary_actions: JSON.stringify(detailData.legendary_actions)
                        };
                        const monsterQuery = "INSERT INTO monsters (`index`, `name`, `size`, `type`, `subtype`, `alignment`, `armor_class`, `hit_points`, `hit_dice`, `speed`, `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma`, `damage_vulnerabilities`, `damage_resistances`, `damage_immunities`, `senses`, `languages`, `challenge_rating`, `xp`, `special_abilities`, `actions`, `legendary_actions`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `size`=VALUES(size), `type`=VALUES(type), `subtype`=VALUES(subtype), `alignment`=VALUES(alignment), `armor_class`=VALUES(armor_class), `hit_points`=VALUES(hit_points), `hit_dice`=VALUES(hit_dice), `speed`=VALUES(speed), `strength`=VALUES(strength), `dexterity`=VALUES(dexterity), `constitution`=VALUES(constitution), `intelligence`=VALUES(intelligence), `wisdom`=VALUES(wisdom), `charisma`=VALUES(charisma), `damage_vulnerabilities`=VALUES(damage_vulnerabilities), `damage_resistances`=VALUES(damage_resistances), `damage_immunities`=VALUES(damage_immunities), `senses`=VALUES(senses), `languages`=VALUES(languages), `challenge_rating`=VALUES(challenge_rating), `xp`=VALUES(xp), `special_abilities`=VALUES(special_abilities), `actions`=VALUES(actions), `legendary_actions`=VALUES(legendary_actions)";
                        await queryAsync(connection, monsterQuery, Object.values(monsterRecord));

                        await queryAsync(connection, "DELETE FROM monster_proficiencies WHERE monster_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM monster_condition_immunities WHERE monster_index = ?", [detailData.index]);

                        for (const prof of detailData.proficiencies) {
                            const profRecord = {
                                monster_index: detailData.index,
                                proficiency_index: prof.proficiency.index,
                                value: prof.value
                            };
                            await queryAsync(connection, "INSERT INTO monster_proficiencies SET ?", profRecord);
                        }
                        
                        const processedConditions = new Set();
                        for (const cond of detailData.condition_immunities) {
                            if (!processedConditions.has(cond.index)) {
                                await queryAsync(connection, "INSERT INTO monster_condition_immunities (monster_index, condition_index) VALUES (?, ?)", [detailData.index, cond.index]);
                                processedConditions.add(cond.index);
                            }
                        }

                        connection.commit(err => {
                            if (err) { return connection.rollback(() => reject(err)); }
                            console.log(`Successfully committed data for ${monsterItem.name}`);
                            resolve();
                        });
                    } catch (e) {
                        connection.rollback(() => reject(e));
                    }
                });
            });
        }
        res.status(200).json({ success: true, message: `Monsters synced successfully! ${monsterEndpoints.length} records processed.` });
    } catch (error) {
        console.error(`An error occurred during the monsters sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for monsters closed.`));
        }
    }
}

async function syncProficiencies(res) {
    console.log('Received request to sync proficiencies (enriched)...');
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for proficiencies sync.`);
                resolve();
            });
        });

        const listResponse = await fetch('https://www.dnd5eapi.co/api/proficiencies');
        const listData = await listResponse.json();
        const proficiencyEndpoints = listData.results;

        for (const profItem of proficiencyEndpoints) {
            console.log(`--- Processing proficiency: ${profItem.name} ---`);
            const detailResponse = await fetch(`https://www.dnd5eapi.co${profItem.url}`);
            const detailData = await detailResponse.json();

            await new Promise((resolve, reject) => {
                connection.beginTransaction(async (err) => {
                    if (err) { return reject(err); }

                    try {
                        const profRecord = {
                            index: detailData.index,
                            name: detailData.name,
                            type: detailData.type,
                            reference_index: detailData.reference ? detailData.reference.index : null
                        };
                        const profQuery = "INSERT INTO proficiencies (`index`, `name`, `type`, `reference_index`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `type`=VALUES(type), `reference_index`=VALUES(reference_index)";
                        await queryAsync(connection, profQuery, Object.values(profRecord));

                        await queryAsync(connection, "DELETE FROM proficiency_classes WHERE proficiency_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM proficiency_races WHERE proficiency_index = ?", [detailData.index]);

                        for (const c of detailData.classes) {
                            await queryAsync(connection, "INSERT INTO proficiency_classes (proficiency_index, class_index) VALUES (?, ?)", [detailData.index, c.index]);
                        }
                        
                        for (const r of detailData.races) {
                            await queryAsync(connection, "INSERT INTO proficiency_races (proficiency_index, race_index) VALUES (?, ?)", [detailData.index, r.index]);
                        }

                        connection.commit(err => {
                            if (err) { return connection.rollback(() => reject(err)); }
                            console.log(`Successfully committed data for ${profItem.name}`);
                            resolve();
                        });
                    } catch (e) {
                        connection.rollback(() => reject(e));
                    }
                });
            });
        }
        res.status(200).json({ success: true, message: `Proficiencies synced successfully! ${proficiencyEndpoints.length} records processed.` });
    } catch (error) {
        console.error(`An error occurred during the proficiencies sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for proficiencies closed.`));
        }
    }
}

async function syncRaces(res) {
    console.log('Received request to sync races (enriched)...');
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for races sync.`);
                resolve();
            });
        });

        const listResponse = await fetch('https://www.dnd5eapi.co/api/races');
        const listData = await listResponse.json();
        const raceEndpoints = listData.results;

        for (const raceItem of raceEndpoints) {
            console.log(`--- Processing race: ${raceItem.name} ---`);
            const detailResponse = await fetch(`https://www.dnd5eapi.co${raceItem.url}`);
            const detailData = await detailResponse.json();

            await new Promise((resolve, reject) => {
                connection.beginTransaction(async (err) => {
                    if (err) { return reject(err); }

                    try {
                        const raceRecord = {
                            index: detailData.index, name: detailData.name, speed: detailData.speed,
                            ability_bonuses: JSON.stringify(detailData.ability_bonuses),
                            alignment: detailData.alignment, age: detailData.age, size: detailData.size,
                            size_description: detailData.size_description,
                            language_desc: detailData.language_desc
                        };
                        const raceQuery = "INSERT INTO races (`index`, `name`, `speed`, `ability_bonuses`, `alignment`, `age`, `size`, `size_description`, `language_desc`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `speed`=VALUES(speed), `ability_bonuses`=VALUES(ability_bonuses), `alignment`=VALUES(alignment), `age`=VALUES(age), `size`=VALUES(size), `size_description`=VALUES(size_description), `language_desc`=VALUES(language_desc)";
                        await queryAsync(connection, raceQuery, Object.values(raceRecord));

                        await queryAsync(connection, "DELETE FROM race_proficiencies WHERE race_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM race_languages WHERE race_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM race_traits WHERE race_index = ?", [detailData.index]);

                        for (const prof of detailData.starting_proficiencies) {
                            await queryAsync(connection, "INSERT INTO race_proficiencies (race_index, proficiency_index) VALUES (?, ?)", [detailData.index, prof.index]);
                        }
                        
                        for (const lang of detailData.languages) {
                            await queryAsync(connection, "INSERT INTO race_languages (race_index, language_index) VALUES (?, ?)", [detailData.index, lang.index]);
                        }

                        for (const trait of detailData.traits) {
                            await queryAsync(connection, "INSERT INTO race_traits (race_index, trait_index) VALUES (?, ?)", [detailData.index, trait.index]);
                        }

                        connection.commit(err => {
                            if (err) { return connection.rollback(() => reject(err)); }
                            console.log(`Successfully committed data for ${raceItem.name}`);
                            resolve();
                        });
                    } catch (e) {
                        connection.rollback(() => reject(e));
                    }
                });
            });
        }
        res.status(200).json({ success: true, message: `Races synced successfully! ${raceEndpoints.length} records processed.` });
    } catch (error) {
        console.error(`An error occurred during the races sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for races closed.`));
        }
    }
}

async function syncSpells(res) {
    console.log('Received request to sync spells (enriched)...');
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for spells sync.`);
                resolve();
            });
        });

        const listResponse = await fetch('https://www.dnd5eapi.co/api/spells');
        const listData = await listResponse.json();
        const spellEndpoints = listData.results;

        for (const spellItem of spellEndpoints) {
            console.log(`--- Processing spell: ${spellItem.name} ---`);
            const detailResponse = await fetch(`https://www.dnd5eapi.co${spellItem.url}`);
            const detailData = await detailResponse.json();

            await new Promise((resolve, reject) => {
                connection.beginTransaction(async (err) => {
                    if (err) { return reject(err); }

                    try {
                        const spellRecord = {
                            index: detailData.index, name: detailData.name,
                            description: detailData.desc.join('\n\n'),
                            higher_level: detailData.higher_level ? detailData.higher_level.join('\n\n') : null,
                            spell_range: detailData.range,
                            components: JSON.stringify(detailData.components),
                            material: detailData.material || null,
                            ritual: detailData.ritual,
                            duration: detailData.duration,
                            concentration: detailData.concentration,
                            casting_time: detailData.casting_time,
                            spell_level: detailData.level,
                            school_index: detailData.school.index,
                            damage: JSON.stringify(detailData.damage)
                        };
                        const spellQuery = "INSERT INTO spells (`index`, `name`, `description`, `higher_level`, `spell_range`, `components`, `material`, `ritual`, `duration`, `concentration`, `casting_time`, `spell_level`, `school_index`, `damage`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description), `higher_level`=VALUES(higher_level), `spell_range`=VALUES(spell_range), `components`=VALUES(components), `material`=VALUES(material), `ritual`=VALUES(ritual), `duration`=VALUES(duration), `concentration`=VALUES(concentration), `casting_time`=VALUES(casting_time), `spell_level`=VALUES(spell_level), `school_index`=VALUES(school_index), `damage`=VALUES(damage)";
                        await queryAsync(connection, spellQuery, Object.values(spellRecord));

                        await queryAsync(connection, "DELETE FROM spell_classes WHERE spell_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM spell_subclasses WHERE spell_index = ?", [detailData.index]);

                        for (const c of detailData.classes) {
                            await queryAsync(connection, "INSERT INTO spell_classes (spell_index, class_index) VALUES (?, ?)", [detailData.index, c.index]);
                        }
                        
                        for (const sc of detailData.subclasses) {
                            await queryAsync(connection, "INSERT INTO spell_subclasses (spell_index, subclass_index) VALUES (?, ?)", [detailData.index, sc.index]);
                        }

                        connection.commit(err => {
                            if (err) { return connection.rollback(() => reject(err)); }
                            console.log(`Successfully committed data for ${spellItem.name}`);
                            resolve();
                        });
                    } catch (e) {
                        connection.rollback(() => reject(e));
                    }
                });
            });
        }
        res.status(200).json({ success: true, message: `Spells synced successfully! ${spellEndpoints.length} records processed.` });
    } catch (error) {
        console.error(`An error occurred during the spells sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for spells closed.`));
        }
    }
}

async function syncSubclasses(res) {
    console.log('Received request to sync subclasses (enriched)...');
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for subclasses sync.`);
                resolve();
            });
        });

        const listResponse = await fetch('https://www.dnd5eapi.co/api/subclasses');
        const listData = await listResponse.json();
        const subclassEndpoints = listData.results;

        for (const subItem of subclassEndpoints) {
            console.log(`--- Processing subclass: ${subItem.name} ---`);
            const detailResponse = await fetch(`https://www.dnd5eapi.co${subItem.url}`);
            const detailData = await detailResponse.json();
            
            const levelsResponse = await fetch(`https://www.dnd5eapi.co${detailData.subclass_levels}`);
            const levelsData = await levelsResponse.json();

            await new Promise((resolve, reject) => {
                connection.beginTransaction(async (err) => {
                    if (err) { return reject(err); }

                    try {
                        const subRecord = {
                            index: detailData.index,
                            name: detailData.name,
                            class_index: detailData.class.index,
                            subclass_flavor: detailData.subclass_flavor,
                            description: detailData.desc.join('\n\n')
                        };
                        const subQuery = "INSERT INTO subclasses (`index`, `name`, `class_index`, `subclass_flavor`, `description`) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `class_index`=VALUES(class_index), `subclass_flavor`=VALUES(subclass_flavor), `description`=VALUES(description)";
                        await queryAsync(connection, subQuery, Object.values(subRecord));

                        await queryAsync(connection, "DELETE FROM subclass_levels WHERE subclass_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM subclass_spells WHERE subclass_index = ?", [detailData.index]);

                        for (const level of levelsData) {
                            const levelRecord = {
                                subclass_index: detailData.index,
                                level: level.level,
                                features: JSON.stringify(level.features.map(f => f.index))
                            };
                            await queryAsync(connection, "INSERT INTO subclass_levels SET ?", levelRecord);
                        }

                        if (detailData.spells) {
                            const processedSpells = new Set();
                            for (const spell of detailData.spells) {
                                if (!processedSpells.has(spell.spell.index)) {
                                    const spellRecord = {
                                        subclass_index: detailData.index,
                                        spell_index: spell.spell.index,
                                        prerequisites: JSON.stringify(spell.prerequisites.map(p => p.index))
                                    };
                                    await queryAsync(connection, "INSERT INTO subclass_spells SET ?", spellRecord);
                                    processedSpells.add(spell.spell.index);
                                }
                            }
                        }

                        connection.commit(err => {
                            if (err) { return connection.rollback(() => reject(err)); }
                            console.log(`Successfully committed data for ${subItem.name}`);
                            resolve();
                        });
                    } catch (e) {
                        connection.rollback(() => reject(e));
                    }
                });
            });
        }
        res.status(200).json({ success: true, message: `Subclasses synced successfully! ${subclassEndpoints.length} records processed.` });
    } catch (error) {
        console.error(`An error occurred during the subclasses sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for subclasses closed.`));
        }
    }
}

async function syncTraits(res) {
    console.log('Received request to sync traits (enriched)...');
    const connection = mysql.createConnection(dbConfig);

    try {
        await new Promise((resolve, reject) => {
            connection.connect(err => {
                if (err) return reject(err);
                console.log(`Successfully connected to MySQL for traits sync.`);
                resolve();
            });
        });

        const listResponse = await fetch('https://www.dnd5eapi.co/api/traits');
        const listData = await listResponse.json();
        const traitEndpoints = listData.results;

        for (const traitItem of traitEndpoints) {
            console.log(`--- Processing trait: ${traitItem.name} ---`);
            const detailResponse = await fetch(`https://www.dnd5eapi.co${traitItem.url}`);
            const detailData = await detailResponse.json();

            await new Promise((resolve, reject) => {
                connection.beginTransaction(async (err) => {
                    if (err) { return reject(err); }

                    try {
                        const traitRecord = {
                            index: detailData.index,
                            name: detailData.name,
                            description: detailData.desc.join('\n\n')
                        };
                        const traitQuery = "INSERT INTO traits (`index`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description)";
                        await queryAsync(connection, traitQuery, Object.values(traitRecord));

                        await queryAsync(connection, "DELETE FROM trait_races WHERE trait_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM trait_subraces WHERE trait_index = ?", [detailData.index]);
                        await queryAsync(connection, "DELETE FROM trait_proficiencies WHERE trait_index = ?", [detailData.index]);

                        for (const race of detailData.races) {
                            await queryAsync(connection, "INSERT INTO trait_races (trait_index, race_index) VALUES (?, ?)", [detailData.index, race.index]);
                        }

                        for (const subrace of detailData.subraces) {
                            await queryAsync(connection, "INSERT INTO trait_subraces (trait_index, subrace_index) VALUES (?, ?)", [detailData.index, subrace.index]);
                        }

                        for (const prof of detailData.proficiencies) {
                            await queryAsync(connection, "INSERT INTO trait_proficiencies (trait_index, proficiency_index) VALUES (?, ?)", [detailData.index, prof.index]);
                        }

                        connection.commit(err => {
                            if (err) { return connection.rollback(() => reject(err)); }
                            console.log(`Successfully committed data for ${traitItem.name}`);
                            resolve();
                        });
                    } catch (e) {
                        connection.rollback(() => reject(e));
                    }
                });
            });
        }
        res.status(200).json({ success: true, message: `Traits synced successfully! ${traitEndpoints.length} records processed.` });
    } catch (error) {
        console.error(`An error occurred during the traits sync process:`, error);
        res.status(500).json({ success: false, message: error.message || 'An error occurred on the server.' });
    } finally {
        if (connection && connection.state !== 'disconnected') {
            connection.end(() => console.log(`MySQL connection for traits closed.`));
        }
    }
}


function queryAsync(connection, sql, values) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
}


// --- 6. Define All Server Endpoints ---

app.get('/sync-ability-scores', (req, res) => syncResource('ability-scores', 'ability_scores', (detailData) => {
    const newRecord = {
        index: detailData.index, 
        name: detailData.name,
        description: detailData.desc.join('\n\n')
    };
    return { newRecord, sqlQuery: "INSERT INTO ability_scores (`index`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name` = VALUES(name), `description` = VALUES(description)" };
}, res));

app.get('/sync-classes', (req, res) => syncClasses(res));
app.get('/sync-monsters', (req, res) => syncMonsters(res));
app.get('/sync-proficiencies', (req, res) => syncProficiencies(res));
app.get('/sync-races', (req, res) => syncRaces(res));
app.get('/sync-rules', (req, res) => syncResource('rules', 'rules', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name,
        description: detailData.desc,
        rule_section_index: detailData.rule_section ? detailData.rule_section.index : null
    };
    return { newRecord, sqlQuery: "INSERT INTO rules (`index`, `name`, `description`, `rule_section_index`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description), `rule_section_index`=VALUES(rule_section_index)" };
}, res));
app.get('/sync-rule-sections', (req, res) => syncResource('rule-sections', 'rule_sections', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name,
        description: detailData.desc
    };
    return { newRecord, sqlQuery: "INSERT INTO rule_sections (`index`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description)" };
}, res));

app.get('/sync-spells', (req, res) => syncSpells(res));
app.get('/sync-subclasses', (req, res) => syncSubclasses(res));
app.get('/sync-traits', (req, res) => syncTraits(res));

app.get('/sync-skills', (req, res) => syncResource('skills', 'skills', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name,
        description: detailData.desc.join('\n\n'),
        ability_score: detailData.ability_score.name
    };
    return { newRecord, sqlQuery: "INSERT INTO skills (`index`, `name`, `description`, `ability_score`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description), `ability_score`=VALUES(ability_score)" };
}, res));

app.get('/sync-subraces', (req, res) => syncResource('subraces', 'subraces', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name, race_index: detailData.race.index,
        description: detailData.desc || null, 
        ability_bonuses: JSON.stringify(detailData.ability_bonuses)
    };
    return { newRecord, sqlQuery: "INSERT INTO subraces (`index`, `name`, `race_index`, `description`, `ability_bonuses`) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `race_index`=VALUES(race_index), `description`=VALUES(description), `ability_bonuses`=VALUES(ability_bonuses)" };
}, res));

app.get('/sync-magic-schools', (req, res) => syncResource('magic-schools', 'magic_schools', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name,
        description: detailData.desc,
    };
    return { newRecord, sqlQuery: "INSERT INTO magic_schools (`index`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description)" };
}, res));

app.get('/sync-languages', (req, res) => syncResource('languages', 'languages', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name, type: detailData.type,
        typical_speakers: JSON.stringify(detailData.typical_speakers),
        script: detailData.script
    };
    return { newRecord, sqlQuery: "INSERT INTO languages (`index`, `name`, `type`, `typical_speakers`, `script`) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `type`=VALUES(type), `typical_speakers`=VALUES(typical_speakers), `script`=VALUES(script)" };
}, res));

app.get('/sync-features', (req, res) => syncResource('features', 'features', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name,
        class: detailData.class.name,
        subclass: detailData.subclass ? detailData.subclass.name : null,
        level: detailData.level,
        description: detailData.desc.join('\n\n')
    };
    return { newRecord, sqlQuery: "INSERT INTO features (`index`, `name`, `class`, `subclass`, `level`, `description`) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `class`=VALUES(class), `subclass`=VALUES(subclass), `level`=VALUES(level), `description`=VALUES(description)" };
}, res));

app.get('/sync-equipment-categories', (req, res) => syncResource('equipment-categories', 'equipment_categories', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name
    };
    return { newRecord, sqlQuery: "INSERT INTO equipment_categories (`index`, `name`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name)" };
}, res));

app.get('/sync-damage-types', (req, res) => syncResource('damage-types', 'damage_types', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name,
        description: detailData.desc.join('\n\n'),
    };
    return { newRecord, sqlQuery: "INSERT INTO damage_types (`index`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description)" };
}, res));

app.get('/sync-conditions', (req, res) => syncResource('conditions', 'conditions', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name,
        description: detailData.desc.join('\n\n'),
    };
    return { newRecord, sqlQuery: "INSERT INTO conditions (`index`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description)" };
}, res));

app.get('/sync-equipment', (req, res) => syncResource('equipment', 'equipment', (detailData) => {
    const newRecord = {
        index: detailData.index, name: detailData.name,
        equipment_category_index: detailData.equipment_category ? detailData.equipment_category.index : null,
        gear_category: detailData.gear_category ? detailData.gear_category.name : null,
        cost: detailData.cost ? `${detailData.cost.quantity} ${detailData.cost.unit}` : null,
        weight: detailData.weight || null,
        description: detailData.desc ? detailData.desc.join('\n\n') : null,
        weapon_category: detailData.weapon_category || null,
        weapon_range: detailData.weapon_range || null,
        category_range: detailData.category_range || null,
        damage: JSON.stringify(detailData.damage),
        two_handed_damage: JSON.stringify(detailData.two_handed_damage),
        range_info: JSON.stringify(detailData.range),
        properties: JSON.stringify(detailData.properties ? detailData.properties.map(p => p.name) : []),
        armor_category: detailData.armor_category || null,
        armor_class: JSON.stringify(detailData.armor_class),
        str_minimum: detailData.str_minimum === undefined ? null : detailData.str_minimum,
        stealth_disadvantage: detailData.stealth_disadvantage === undefined ? null : detailData.stealth_disadvantage,
        contents: JSON.stringify(detailData.contents),
        speed_info: JSON.stringify(detailData.speed),
        capacity: detailData.capacity || null
    };
    const sqlQuery = "INSERT INTO equipment (`index`, `name`, `equipment_category_index`, `gear_category`, `cost`, `weight`, `description`, `weapon_category`, `weapon_range`, `category_range`, `damage`, `two_handed_damage`, `range_info`, `properties`, `armor_category`, `armor_class`, `str_minimum`, `stealth_disadvantage`, `contents`, `speed_info`, `capacity`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `equipment_category_index`=VALUES(equipment_category_index), `gear_category`=VALUES(gear_category), `cost`=VALUES(cost), `weight`=VALUES(weight), `description`=VALUES(description), `weapon_category`=VALUES(weapon_category), `weapon_range`=VALUES(weapon_range), `category_range`=VALUES(category_range), `damage`=VALUES(damage), `two_handed_damage`=VALUES(two_handed_damage), `range_info`=VALUES(range_info), `properties`=VALUES(properties), `armor_category`=VALUES(armor_category), `armor_class`=VALUES(armor_class), `str_minimum`=VALUES(str_minimum), `stealth_disadvantage`=VALUES(stealth_disadvantage), `contents`=VALUES(contents), `speed_info`=VALUES(speed_info), `capacity`=VALUES(capacity)";
    return { newRecord, sqlQuery };
}, res));

app.get('/sync-magic-items', (req, res) => syncResource('magic-items', 'magic_items', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name,
        equipment_category_index: detailData.equipment_category ? detailData.equipment_category.index : null,
        rarity_name: detailData.rarity.name,
        description: detailData.desc.join('\n\n')
    };
    return { newRecord, sqlQuery: "INSERT INTO magic_items (`index`, `name`, `equipment_category_index`, `rarity_name`, `description`) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `equipment_category_index`=VALUES(equipment_category_index), `rarity_name`=VALUES(rarity_name), `description`=VALUES(description)" };
}, res));

app.get('/sync-alignments', (req, res) => syncResource('alignments', 'alignments', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name,
        abbreviation: detailData.abbreviation,
        description: detailData.desc
    };
    return { newRecord, sqlQuery: "INSERT INTO alignments (`index`, `name`, `abbreviation`, `description`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `abbreviation`=VALUES(abbreviation), `description`=VALUES(description)" };
}, res));

app.get('/sync-backgrounds', (req, res) => syncResource('backgrounds', 'backgrounds', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name,
        starting_proficiencies: JSON.stringify(detailData.starting_proficiencies.map(p => p.name)),
        language_options: JSON.stringify(detailData.language_options),
        starting_equipment: JSON.stringify(detailData.starting_equipment.map(e => ({ name: e.equipment.name, quantity: e.quantity }))),
        feature_name: detailData.feature.name,
        feature_desc: detailData.feature.desc.join('\n\n'),
        personality_traits: JSON.stringify(detailData.personality_traits.from.options.map(o => o.string)),
        ideals: JSON.stringify(detailData.ideals.from.options.map(o => o.string)),
        bonds: JSON.stringify(detailData.bonds.from.options.map(o => o.string)),
        flaws: JSON.stringify(detailData.flaws.from.options.map(o => o.string))
    };
    return { newRecord, sqlQuery: "INSERT INTO backgrounds (`index`, `name`, `starting_proficiencies`, `language_options`, `starting_equipment`, `feature_name`, `feature_desc`, `personality_traits`, `ideals`, `bonds`, `flaws`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `starting_proficiencies`=VALUES(starting_proficiencies), `language_options`=VALUES(language_options), `starting_equipment`=VALUES(starting_equipment), `feature_name`=VALUES(feature_name), `feature_desc`=VALUES(feature_desc), `personality_traits`=VALUES(personality_traits), `ideals`=VALUES(ideals), `bonds`=VALUES(bonds), `flaws`=VALUES(flaws)" };
}, res));

app.get('/sync-feats', (req, res) => syncResource('feats', 'feats', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name,
        prerequisites: JSON.stringify(detailData.prerequisites),
        description: detailData.desc.join('\n\n')
    };
    return { newRecord, sqlQuery: "INSERT INTO feats (`index`, `name`, `prerequisites`, `description`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `prerequisites`=VALUES(prerequisites), `description`=VALUES(description)" };
}, res));

app.get('/sync-weapon-properties', (req, res) => syncResource('weapon-properties', 'weapon_properties', (detailData) => {
    const newRecord = {
        index: detailData.index,
        name: detailData.name,
        description: detailData.desc.join('\n\n')
    };
    return { newRecord, sqlQuery: "INSERT INTO weapon_properties (`index`, `name`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `name`=VALUES(name), `description`=VALUES(description)" };
}, res));


// --- 6. Start the Server ---
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    console.log('Control panel is now available at this address.');
    console.log('Available sync API endpoints:');
    const endpoints = [
        '/sync-ability-scores', '/sync-classes', '/sync-spells', '/sync-races', 
        '/sync-skills', '/sync-subraces', '/sync-subclasses', '/sync-traits', 
        '/sync-proficiencies', '/sync-magic-schools', '/sync-languages', 
        '/sync-features', '/sync-equipment-categories', '/sync-damage-types', 
        '/sync-conditions', '/sync-monsters', '/sync-equipment', '/sync-magic-items',
        '/sync-alignments', '/sync-backgrounds', '/sync-feats', '/sync-rules', '/sync-rule-sections',
        '/sync-weapon-properties'
    ];
    endpoints.forEach(endpoint => console.log(`  GET http://localhost:${PORT}${endpoint}`));
});
