package com.ikshanasolutions.disha.model

/**
 * Swipe pages for the home grid. Six checks fill a 2×3 page. A longer
 * category continues as "Name 2/2" so a page never needs to scroll.
 */
data class HomePage(
    val id: String,
    val title: L10n,
    val checks: List<VaastuCheck>,
)

private const val PAGE_SIZE = 6

fun homePages(checks: List<VaastuCheck>): List<HomePage> {
    val pages = mutableListOf<HomePage>()
    for (group in checkGroups(checks)) {
        val chunks = if (group.checks.size <= PAGE_SIZE) {
            listOf(group.checks)
        } else {
            group.checks.chunked(PAGE_SIZE)
        }
        chunks.forEachIndexed { index, chunk ->
            val title = if (chunks.size == 1) {
                group.group
            } else {
                val part = "${index + 1}/${chunks.size}"
                L10n("${group.group.en} $part", "${group.group.hi} $part")
            }
            pages += HomePage(id = "${group.group.en}:$index", title = title, checks = chunk)
        }
    }
    return pages
}
