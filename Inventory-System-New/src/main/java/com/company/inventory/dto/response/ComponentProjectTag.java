package com.company.inventory.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** "This component is in project X's folder" — shown on the component in the main inventory. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ComponentProjectTag {
    private Long projectId;
    private String projectName;
    /** Units put in that project's folder. */
    private int allocated;
    /** Of those, not yet used in the project. */
    private int remaining;
}
