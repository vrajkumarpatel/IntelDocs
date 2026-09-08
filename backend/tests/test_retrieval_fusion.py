from app.services.retrieval import reciprocal_rank_fusion


def test_rrf_favors_items_ranked_highly_in_both_lists():
    vector_ranking = [1, 2, 3, 4]
    bm25_ranking = [2, 1, 5, 6]
    fused = reciprocal_rank_fusion([vector_ranking, bm25_ranking])
    fused_ids = [cid for cid, _ in fused]
    # 1 and 2 appear near the top of both lists, so they should fuse to the top.
    assert set(fused_ids[:2]) == {1, 2}


def test_rrf_item_present_in_both_lists_outranks_single_list_item():
    # id 10 is rank 1 in both lists; id 20 is rank 1 in only one list.
    fused = reciprocal_rank_fusion([[10, 99], [10, 88]])
    scores = dict(fused)
    only_one_list = reciprocal_rank_fusion([[20, 99], [88, 30]])
    only_scores = dict(only_one_list)
    assert scores[10] > only_scores[20]


def test_rrf_empty_lists_returns_empty():
    assert reciprocal_rank_fusion([[], []]) == []


def test_rrf_single_list_preserves_order():
    fused = reciprocal_rank_fusion([[5, 3, 1]])
    fused_ids = [cid for cid, _ in fused]
    assert fused_ids == [5, 3, 1]


def test_rrf_deterministic_tie_break_by_id():
    # Two items that never co-occur and have identical rank position (rank 1
    # in disjoint lists) tie on score; ties break by chunk_id ascending.
    fused = reciprocal_rank_fusion([[7], [3]])
    fused_ids = [cid for cid, _ in fused]
    assert fused_ids == [3, 7]


def test_rrf_score_formula_matches_definition():
    # k defaults to 60. Single list [42] at rank 1 -> score = 1/(60+1).
    fused = reciprocal_rank_fusion([[42]])
    assert fused == [(42, 1.0 / 61)]


def test_rrf_combines_more_than_two_lists():
    fused = reciprocal_rank_fusion([[1, 2], [2, 3], [2, 1]])
    fused_ids = [cid for cid, _ in fused]
    # id 2 appears in all three lists at good ranks -> should be first.
    assert fused_ids[0] == 2
