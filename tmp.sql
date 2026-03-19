WITH RECURSIVE
  loop_0(stru_id, sup_stru, distance) AS (
    SELECT loop_base_2.stru_id, loop_base_2.sup_stru, 1 AS distance
    FROM (
    SELECT loop_base_1.stru_id, loop_base_1.sup_stru
    FROM (
    SELECT loop_base_0.stru_id, loop_base_0.sup_stru
    FROM (
    SELECT dcm_bom_basic_info_s_0.stru_id, dcm_bom_basic_info_s_0.sup_stru
    FROM bom.dcm_bom_basic_info_s AS dcm_bom_basic_info_s_0
    WHERE dcm_bom_basic_info_s_0.pt_dt = date_add('day', -1, CURRENT_DATE) AND dcm_bom_basic_info_s_0.stru_state IN ('1', '2')) AS loop_base_0) AS loop_base_1
    WHERE NOT length(loop_base_1.sup_stru) = 0) AS loop_base_2
    UNION ALL
    SELECT loop_0_0.stru_id AS stru_id, dcm_bom_basic_info_s_1.sup_stru AS sup_stru, loop_0_0.distance + 1 AS distance
    FROM loop_0 AS loop_0_0
    INNER JOIN (
    SELECT loop_step_join_sq_2.stru_id, loop_step_join_sq_2.sup_stru, 1 AS distance
    FROM (
    SELECT dcm_bom_basic_info_s_0.stru_id, dcm_bom_basic_info_s_0.sup_stru
    FROM bom.dcm_bom_basic_info_s AS dcm_bom_basic_info_s_0
    WHERE dcm_bom_basic_info_s_0.pt_dt = date_add('day', -1, CURRENT_DATE) AND dcm_bom_basic_info_s_0.stru_state IN ('1', '2') AND NOT length(dcm_bom_basic_info_s_0.sup_stru) = 0) AS loop_step_join_sq_2) AS dcm_bom_basic_info_s_1
    ON loop_0_0.sup_stru = dcm_bom_basic_info_s_1.stru_id)
SELECT loop_0_0.stru_id AS stru_id, loop_0_0.sup_stru AS sup_stru, loop_0_0.distance AS distance
FROM loop_0 AS loop_0_0
ORDER BY loop_0_0.stru_id ASC, loop_0_0.distance ASC, loop_0_0.sup_stru ASC
