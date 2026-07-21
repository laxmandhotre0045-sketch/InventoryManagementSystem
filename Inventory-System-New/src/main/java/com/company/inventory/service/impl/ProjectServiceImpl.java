package com.company.inventory.service.impl;

import com.company.inventory.dto.request.ProjectRequest;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.dto.response.ProjectResponse;
import com.company.inventory.entity.Project;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.ProjectMapper;
import com.company.inventory.repository.ProjectRepository;
import com.company.inventory.service.ProjectService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;

@Service
@Transactional
public class ProjectServiceImpl implements ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMapper projectMapper;

    public ProjectServiceImpl(ProjectRepository projectRepository, ProjectMapper projectMapper) {
        this.projectRepository = projectRepository;
        this.projectMapper = projectMapper;
    }

    @Override
    public ProjectResponse createProject(ProjectRequest request) {
        Project entity = projectMapper.toEntity(request);
        Project saved = projectRepository.save(entity);
        return projectMapper.toResponse(saved);
    }

    @Override
    public ProjectResponse updateProject(Long id, ProjectRequest request) {
        Project existing = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));
        projectMapper.updateEntity(request, existing);
        Project updated = projectRepository.save(existing);
        return projectMapper.toResponse(updated);
    }

    @Override
    public void deleteProject(Long id) {
        Project existing = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));
        projectRepository.delete(existing);
    }

    @Override
    public ProjectResponse getProjectById(Long id) {
        Project existing = projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));
        return projectMapper.toResponse(existing);
    }

    @Override
    public PagedResponse<ProjectResponse> getAllProjects(int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<Project> projectPage = projectRepository.findAll(pageable);
        return mapPage(projectPage);
    }

    @Override
    public PagedResponse<ProjectResponse> searchProjects(String keyword, int page, int size, String sortBy, String sortDir) {
        Pageable pageable = createPageable(page, size, sortBy, sortDir);
        Page<Project> projectPage = projectRepository.findByProjectNameContainingIgnoreCase(keyword, pageable);
        return mapPage(projectPage);
    }

    private Pageable createPageable(int page, int size, String sortBy, String sortDir) {
        Sort sort = Sort.by(sortBy);
        sort = "desc".equalsIgnoreCase(sortDir) ? sort.descending() : sort.ascending();
        return PageRequest.of(page, size, sort);
    }

    private PagedResponse<ProjectResponse> mapPage(Page<Project> pageData) {
        PagedResponse<ProjectResponse> response = new PagedResponse<>();
        response.setContent(pageData.stream().map(projectMapper::toResponse).collect(Collectors.toList()));
        response.setPage(pageData.getNumber());
        response.setSize(pageData.getSize());
        response.setTotalElements(pageData.getTotalElements());
        response.setTotalPages(pageData.getTotalPages());
        response.setLast(pageData.isLast());
        return response;
    }
}
